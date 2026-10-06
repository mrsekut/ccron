import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type {
  AbsoluteDir,
  Job,
  JobName,
  Manifest,
  ManifestId,
  NonEmptyString,
} from './domain';
import { execute } from './execute';
import type { RenderEnv } from './generator';
import { defaultPaths, plistPath, scriptPath, type Paths } from './paths';
import { actionName, plan } from './plan';
import { readState, resolveManifestPath } from './state';
import { fakeLaunchd } from './testing/fake-launchd';

let root: string;
let paths: Paths;
let env: RenderEnv;

beforeEach(async () => {
  root = await resolveManifestPath(await mkdtemp(join(tmpdir(), 'ccron-')));
  paths = defaultPaths(join(root, 'home'));
  env = {
    manifestId: join(root, 'ccron.json') as ManifestId,
    claudeDir: '/usr/local/bin',
    home: join(root, 'home'),
    paths,
  };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function job(name: string, prompt = 'hello'): Job {
  return {
    name: name as JobName,
    schedule: { expression: '0 9 * * *', intervals: [{ Hour: 9, Minute: 0 }] },
    prompt: prompt as NonEmptyString,
    cwd: root as AbsoluteDir,
  };
}

function manifest(...jobs: Job[]): Manifest {
  return { id: env.manifestId, jobs };
}

async function apply(m: Manifest, fake: ReturnType<typeof fakeLaunchd>) {
  const actual = await readState(paths, m.id, fake);
  const planned = plan(m, actual, env);
  if (!planned.ok) throw new Error('unexpected conflict');
  return execute(planned.value, { paths, launchd: fake.launchd });
}

async function pendingActions(
  m: Manifest,
  fake: ReturnType<typeof fakeLaunchd>,
) {
  const planned = plan(m, await readState(paths, m.id, fake), env);
  if (!planned.ok) throw new Error('unexpected conflict');
  return planned.value.actions
    .filter(a => a.kind !== 'noop')
    .map(a => `${a.kind} ${actionName(a)}`);
}

describe('execute', () => {
  test('create writes files and loads the job', async () => {
    const fake = fakeLaunchd();
    const results = await apply(manifest(job('a')), fake);

    expect(results.map(r => r.ok)).toEqual([true]);
    expect(await Bun.file(plistPath(paths, 'a')).exists()).toBe(true);
    expect((await stat(scriptPath(paths, 'a'))).mode & 0o777).toBe(0o755);
    expect(fake.loaded.has('a')).toBe(true);
    expect(await pendingActions(manifest(job('a')), fake)).toEqual([]);
  });

  test('update rewrites files', async () => {
    const fake = fakeLaunchd();
    await apply(manifest(job('a', 'old')), fake);
    await apply(manifest(job('a', 'new')), fake);

    expect(await Bun.file(scriptPath(paths, 'a')).text()).toContain(
      "PROMPT='new'",
    );
    expect(await pendingActions(manifest(job('a', 'new')), fake)).toEqual([]);
  });

  test('delete unloads and removes files but keeps the log', async () => {
    const fake = fakeLaunchd();
    await apply(manifest(job('a')), fake);
    await Bun.write(join(paths.logs, 'a.log'), 'past run');

    await apply(manifest(), fake);

    expect(fake.loaded.has('a')).toBe(false);
    expect(await Bun.file(plistPath(paths, 'a')).exists()).toBe(false);
    expect(await Bun.file(scriptPath(paths, 'a')).exists()).toBe(false);
    expect(await Bun.file(join(paths.logs, 'a.log')).text()).toBe('past run');
  });

  test('stops at the first failure', async () => {
    const fake = fakeLaunchd(['b']);
    const results = await apply(manifest(job('a'), job('b'), job('c')), fake);

    expect(results.map(r => [actionName(r.action), r.ok])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    expect(results[1]).toMatchObject({ error: 'bootstrap failed: b' });
  });

  test('applying again after a failure converges', async () => {
    const m = manifest(job('a'), job('b'), job('c'));
    const failing = fakeLaunchd(['b']);
    await apply(m, failing);

    // b's files were written but it is not loaded; c was never reached.
    expect(await pendingActions(m, failing)).toEqual(['update b', 'create c']);

    const healthy = fakeLaunchd();
    for (const name of failing.loaded) healthy.loaded.add(name);
    const results = await apply(m, healthy);

    expect(results.every(r => r.ok)).toBe(true);
    expect(await pendingActions(m, healthy)).toEqual([]);
    expect([...healthy.loaded].sort()).toEqual(['a', 'b', 'c']);
  });
});
