import { statSync } from 'fs';
import { readdir, realpath } from 'fs/promises';
import { join } from 'path';
import {
  jobName,
  type ActualJob,
  type ActualState,
  type ManifestId,
  type Owner,
  type PathKind,
} from './domain';
import { MANIFEST_ENV } from './generator';
import { LABEL_PREFIX, scriptPath, type Paths } from './paths';

export type StateDeps = {
  isLoaded: (name: string) => Promise<boolean>;
};

/**
 * Read every installed ccron job from LaunchAgents, classifying ownership as
 * seen from `manifest`. Plists whose name is not a valid job name are skipped:
 * ccron could not have generated them.
 */
export async function readState(
  paths: Paths,
  manifest: ManifestId,
  deps: StateDeps,
): Promise<ActualState> {
  const files = await readdir(paths.launchAgents).catch(() => [] as string[]);
  const jobs: ActualJob[] = [];

  for (const file of files.sort()) {
    if (!file.startsWith(LABEL_PREFIX) || !file.endsWith('.plist')) continue;
    const name = jobName(file.slice(LABEL_PREFIX.length, -'.plist'.length));
    if (!name.ok) continue;

    const plist = await Bun.file(join(paths.launchAgents, file)).text();
    const scriptFile = Bun.file(scriptPath(paths, name.value));
    const script = (await scriptFile.exists()) ? await scriptFile.text() : null;

    jobs.push({
      name: name.value,
      owner: await ownerOf(readRecordedManifest(plist), manifest),
      artifacts:
        script === null
          ? { kind: 'partial', plist }
          : { kind: 'complete', plist, script },
      loaded: await deps.isLoaded(name.value),
    });
  }

  return jobs;
}

async function ownerOf(
  recorded: string | null,
  manifest: ManifestId,
): Promise<Owner> {
  if (recorded === null) return { kind: 'unowned' };
  if (recorded === manifest) return { kind: 'mine' };
  if (pathKind(recorded) === 'missing')
    return { kind: 'orphan', manifest: recorded };
  // Written by ccron from a realpath, so it is already a ManifestId.
  return { kind: 'other', manifest: recorded as ManifestId };
}

const MANIFEST_RE = new RegExp(
  `<key>${MANIFEST_ENV}</key>\\s*<string>([^<]*)</string>`,
);

/** The CCRON_MANIFEST value recorded in a plist, if any. */
export function readRecordedManifest(plist: string): string | null {
  const match = plist.match(MANIFEST_RE);
  return match?.[1] === undefined ? null : unescapeXml(match[1]);
}

function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// --- Filesystem facts for parsing ---

// Synchronous because parseManifest asks for paths one by one while staying pure.
export function pathKind(path: string): PathKind {
  try {
    const s = statSync(path);
    return s.isDirectory() ? 'directory' : 'file';
  } catch {
    return 'missing';
  }
}

/** Resolve symlinks so the same manifest always has the same identity. */
export async function resolveManifestPath(path: string): Promise<string> {
  return realpath(path);
}
