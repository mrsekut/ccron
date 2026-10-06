import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type {
  AbsoluteDir,
  Job,
  JobName,
  ManifestId,
  NonEmptyString,
} from './domain';
import { render, type RenderEnv } from './generator';
import { defaultPaths, plistPath, scriptPath, type Paths } from './paths';
import {
  pathKind,
  readRecordedManifest,
  readState,
  resolveManifestPath,
} from './state';

let root: string;
let paths: Paths;
let mineId: ManifestId;
let otherId: ManifestId;

beforeEach(async () => {
  root = await resolveManifestPath(await mkdtemp(join(tmpdir(), 'ccron-')));
  paths = defaultPaths(join(root, 'home'));
  await mkdir(paths.launchAgents, { recursive: true });
  await mkdir(paths.bin, { recursive: true });
  await writeFile(join(root, 'mine.json'), '{}');
  await writeFile(join(root, 'other.json'), '{}');
  mineId = join(root, 'mine.json') as ManifestId;
  otherId = join(root, 'other.json') as ManifestId;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function job(name: string): Job {
  return {
    name: name as JobName,
    schedule: { expression: '0 9 * * *', intervals: [{ Hour: 9, Minute: 0 }] },
    prompt: 'hello' as NonEmptyString,
    cwd: root as AbsoluteDir,
  };
}

function envFor(manifestId: string): RenderEnv {
  return {
    manifestId: manifestId as ManifestId,
    claudeDir: '/usr/local/bin',
    home: join(root, 'home'),
    paths,
  };
}

async function install(
  name: string,
  owner: string | null,
  { script = true } = {},
) {
  const rendered = render(job(name), envFor(owner ?? 'unused'));
  const plist =
    owner === null
      ? rendered.plist.replace(
          /\s*<key>CCRON_MANIFEST<\/key>\s*<string>[^<]*<\/string>/,
          '',
        )
      : rendered.plist;
  await writeFile(plistPath(paths, name), plist);
  if (script) await writeFile(scriptPath(paths, name), rendered.script);
  return { plist, script: rendered.script };
}

const loadedNames = (names: string[]) => ({
  isLoaded: async (name: string) => names.includes(name),
});

describe('readState', () => {
  test('no LaunchAgents directory → empty', async () => {
    await rm(paths.launchAgents, { recursive: true });
    expect(await readState(paths, mineId, loadedNames([]))).toEqual([]);
  });

  test('classifies owners', async () => {
    await install('a-mine', mineId);
    await install('b-other', otherId);
    await install('c-orphan', join(root, 'gone.json'));
    await install('d-unowned', null);

    const state = await readState(paths, mineId, loadedNames([]));
    expect(state.map(j => [j.name, j.owner])).toEqual([
      ['a-mine' as JobName, { kind: 'mine' }],
      ['b-other' as JobName, { kind: 'other', manifest: otherId }],
      [
        'c-orphan' as JobName,
        { kind: 'orphan', manifest: join(root, 'gone.json') },
      ],
      ['d-unowned' as JobName, { kind: 'unowned' }],
    ]);
  });

  test('reads complete artifacts', async () => {
    const files = await install('a', mineId);
    const [state] = await readState(paths, mineId, loadedNames(['a']));
    expect(state?.artifacts).toEqual({ kind: 'complete', ...files });
    expect(state?.loaded).toBe(true);
  });

  test('plist without script is partial', async () => {
    const files = await install('a', mineId, { script: false });
    const [state] = await readState(paths, mineId, loadedNames([]));
    expect(state?.artifacts).toEqual({ kind: 'partial', plist: files.plist });
    expect(state?.loaded).toBe(false);
  });

  test('ignores files that are not ccron plists', async () => {
    await writeFile(join(paths.launchAgents, 'com.other.x.plist'), '');
    await writeFile(join(paths.launchAgents, 'com.ccron.Bad_Name.plist'), '');
    await writeFile(join(paths.launchAgents, 'com.ccron.a.txt'), '');
    expect(await readState(paths, mineId, loadedNames([]))).toEqual([]);
  });

  test('a manifest reached through a symlink is still mine', async () => {
    const link = join(root, 'link.json');
    await symlink(join(root, 'mine.json'), link);
    await install('a', mineId);

    const viaLink = (await resolveManifestPath(link)) as ManifestId;
    const [state] = await readState(paths, viaLink, loadedNames([]));
    expect(state?.owner).toEqual({ kind: 'mine' });
  });
});

describe('readRecordedManifest', () => {
  test('reads and unescapes the value', () => {
    const plist =
      '<key>CCRON_MANIFEST</key>\n  <string>/a &amp; b/c.json</string>';
    expect(readRecordedManifest(plist)).toBe('/a & b/c.json');
  });

  test('null when absent', () => {
    expect(
      readRecordedManifest('<key>HOME</key><string>/x</string>'),
    ).toBeNull();
  });
});

describe('pathKind', () => {
  test('directory, file, missing', async () => {
    expect(pathKind(root)).toBe('directory');
    expect(pathKind(join(root, 'mine.json'))).toBe('file');
    expect(pathKind(join(root, 'nope'))).toBe('missing');
  });
});
