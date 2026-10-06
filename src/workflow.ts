import { dirname } from 'path';
import {
  err,
  manifestId,
  ok,
  type ActualState,
  type Conflict,
  type Manifest,
  type Plan,
  type Result,
} from './domain';
import type { RenderEnv } from './generator';
import type { Launchd } from './launchd';
import { parseManifest, type ValidationError } from './manifest';
import type { Paths } from './paths';
import { plan } from './plan';
import { pathKind, readState, resolveManifestPath } from './state';

/** Everything that touches the machine, so commands can run against fakes. */
export type Deps = {
  home: string;
  paths: Paths;
  launchd: Launchd;
  /** Directory containing the claude executable, or null if not found. */
  findClaudeDir: () => Promise<string | null>;
};

export type PrepareError =
  | { kind: 'read'; message: string }
  | { kind: 'invalid'; errors: ValidationError[] }
  | { kind: 'claude-not-found' };

export type Prepared = {
  manifest: Manifest;
  actual: ActualState;
  env: RenderEnv;
  plan: Result<Plan, Conflict[]>;
};

/**
 * The shared front half of apply and status:
 * read (I/O) → parse → read actual state (I/O) → plan.
 *
 * Both commands go through here so that `status` and `apply --dry-run` can
 * never disagree.
 */
export async function prepare(
  manifestPath: string,
  deps: Deps,
): Promise<Result<Prepared, PrepareError>> {
  let realPath: string;
  let raw: unknown;
  try {
    realPath = await resolveManifestPath(manifestPath);
    raw = JSON.parse(await Bun.file(realPath).text());
  } catch (e) {
    return err({
      kind: 'read',
      message: `cannot read ${manifestPath}: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  const id = manifestId(realPath);
  if (!id.ok) return err({ kind: 'read', message: id.error });

  const manifest = parseManifest(raw, id.value, { home: deps.home, pathKind });
  if (!manifest.ok) return err({ kind: 'invalid', errors: manifest.error });

  const claudeDir = await deps.findClaudeDir();
  if (claudeDir === null) return err({ kind: 'claude-not-found' });

  const env: RenderEnv = {
    manifestId: id.value,
    claudeDir,
    home: deps.home,
    paths: deps.paths,
  };
  const actual = await readState(deps.paths, id.value, {
    isLoaded: async name => (await deps.launchd.status(name)) !== null,
  });

  return ok({
    manifest: manifest.value,
    actual,
    env,
    plan: plan(manifest.value, actual, env),
  });
}

export async function findClaudeDirOnPath(): Promise<string | null> {
  const result = await Bun.$`which claude`.quiet().nothrow();
  if (result.exitCode !== 0) return null;
  return dirname(result.stdout.toString().trim());
}

export function formatPrepareError(error: PrepareError): string {
  switch (error.kind) {
    case 'read':
      return error.message;
    case 'claude-not-found':
      return 'claude was not found on PATH';
    case 'invalid':
      return [
        `manifest has ${error.errors.length} error(s):`,
        ...error.errors.map(e => {
          const where = [e.job, e.field].filter(Boolean).join('.');
          return `  ${where ? `${where}: ` : ''}${e.message}`;
        }),
      ].join('\n');
  }
}
