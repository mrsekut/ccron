import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { defaultPaths, plistPath } from '../paths';
import { resolveManifestPath } from '../state';
import { fakeLaunchd } from '../testing/fake-launchd';
import type { Deps } from '../workflow';
import { apply } from './apply';
import { status } from './status';

let root: string;
let fake: ReturnType<typeof fakeLaunchd>;
let deps: Deps;

beforeEach(async () => {
  root = await resolveManifestPath(await mkdtemp(join(tmpdir(), 'ccron-')));
  const home = join(root, 'home');
  fake = fakeLaunchd();
  deps = {
    home,
    paths: defaultPaths(home),
    launchd: fake.launchd,
    findClaudeDir: async () => '/usr/local/bin',
  };
  await mkdir(join(root, 'a'), { recursive: true });
  await mkdir(join(root, 'b'), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeManifest(
  dir: string,
  jobs: Record<string, Record<string, unknown>>,
): Promise<string> {
  const path = join(root, dir, 'ccron.json');
  await writeFile(path, JSON.stringify({ jobs }));
  return path;
}

const job = (prompt = 'hello') => ({
  schedule: '0 9 * * *',
  prompt,
  cwd: '.',
});

async function run(
  command: typeof apply,
  ...args: string[]
): Promise<{ code: number; output: string }> {
  const lines: string[] = [];
  const code = await command(args, deps, line => lines.push(line));
  return { code, output: lines.join('\n') };
}

async function installedFiles(): Promise<string[]> {
  return (await readdir(deps.paths.launchAgents).catch(() => [])).sort();
}

describe('apply', () => {
  test('creates declared jobs', async () => {
    const a = await writeManifest('a', { one: job(), two: job() });
    const { code, output } = await run(apply, a);
    expect(code).toBe(0);
    expect(output).toContain('+ create one');
    expect(output).toContain('✓ create two');
    expect([...fake.loaded].sort()).toEqual(['one', 'two']);
  });

  test('applying twice is a no-op', async () => {
    const a = await writeManifest('a', { one: job() });
    await run(apply, a);
    const { code, output } = await run(apply, a);
    expect(code).toBe(0);
    expect(output).toContain('= noop   one');
    expect(output).toContain('Nothing to do.');
  });

  test('two manifests applied in turn keep each other’s jobs', async () => {
    const a = await writeManifest('a', { 'a-job': job() });
    const b = await writeManifest('b', { 'b-job': job() });

    await run(apply, a);
    await run(apply, b);
    const { output } = await run(apply, a);

    expect([...fake.loaded].sort()).toEqual(['a-job', 'b-job']);
    expect(output).toContain(`b-job: owned by ${b}`);
    expect(await installedFiles()).toEqual([
      'com.ccron.a-job.plist',
      'com.ccron.b-job.plist',
    ]);
  });

  test('deletes only jobs this manifest owns', async () => {
    const a = await writeManifest('a', { one: job(), two: job() });
    const b = await writeManifest('b', { other: job() });
    await run(apply, a);
    await run(apply, b);

    await writeManifest('a', { one: job() });
    const { output } = await run(apply, a);

    expect(output).toContain('- delete two');
    expect([...fake.loaded].sort()).toEqual(['one', 'other']);
  });

  test('a manifest reached through a symlink is the same owner', async () => {
    const a = await writeManifest('a', { one: job() });
    const link = join(root, 'link.json');
    await symlink(a, link);

    await run(apply, a);
    const { code, output } = await run(apply, link);

    expect(code).toBe(0);
    expect(output).toContain('= noop   one');
  });

  test('--dry-run changes nothing', async () => {
    const a = await writeManifest('a', { one: job() });
    const { code, output } = await run(apply, a, '--dry-run');
    expect(code).toBe(0);
    expect(output).toContain('+ create one');
    expect(await installedFiles()).toEqual([]);
    expect(fake.loaded.size).toBe(0);
  });

  test('validation errors are all reported and nothing is written', async () => {
    const a = await writeManifest('a', {
      one: job(''),
      two: { ...job(), schedule: '*/5 * * * *' },
    });
    const { code, output } = await run(apply, a);
    expect(code).toBe(1);
    expect(output).toContain('manifest has 2 error(s)');
    expect(output).toContain('one.prompt: must not be empty');
    expect(output).toContain('two.schedule:');
    expect(await installedFiles()).toEqual([]);
  });

  test('a name owned by another manifest is a conflict and nothing is written', async () => {
    const b = await writeManifest('b', { shared: job() });
    await run(apply, b);
    const a = await writeManifest('a', { shared: job(), mine: job() });

    const { code, output } = await run(apply, a);

    expect(code).toBe(1);
    expect(output).toContain(`shared: owned by ${b}`);
    expect(await installedFiles()).toEqual(['com.ccron.shared.plist']);
  });

  test('adopts an unowned job with the same name', async () => {
    await mkdir(deps.paths.launchAgents, { recursive: true });
    await writeFile(plistPath(deps.paths, 'legacy'), '<plist/>');
    const a = await writeManifest('a', { legacy: job() });

    const { code, output } = await run(apply, a);

    expect(code).toBe(0);
    expect(output).toContain('> adopt  legacy');
    expect(await Bun.file(plistPath(deps.paths, 'legacy')).text()).toContain(
      'CCRON_MANIFEST',
    );
  });

  test('a missing manifest is reported', async () => {
    const { code, output } = await run(apply, join(root, 'nope.json'));
    expect(code).toBe(1);
    expect(output).toContain('cannot read');
  });

  test('claude not found stops before writing', async () => {
    deps.findClaudeDir = async () => null;
    const a = await writeManifest('a', { one: job() });
    const { code, output } = await run(apply, a);
    expect(code).toBe(1);
    expect(output).toContain('claude was not found');
    expect(await installedFiles()).toEqual([]);
  });

  test('reports a failure and converges on the next apply', async () => {
    const failing = fakeLaunchd(['two']);
    deps.launchd = failing.launchd;
    const a = await writeManifest('a', { one: job(), two: job() });

    const first = await run(apply, a);
    expect(first.code).toBe(1);
    expect(first.output).toContain('✗ create two: bootstrap failed: two');

    deps.launchd = fake.launchd;
    for (const name of failing.loaded) fake.loaded.add(name);
    const second = await run(apply, a);
    expect(second.code).toBe(0);
    expect(second.output).toContain('~ update two');
    expect([...fake.loaded].sort()).toEqual(['one', 'two']);
  });
});

describe('status', () => {
  test('agrees with apply --dry-run', async () => {
    const a = await writeManifest('a', { same: job(), changed: job('old') });
    await run(apply, a);
    await writeManifest('a', {
      same: job(),
      changed: job('new'),
      added: job(),
    });

    const dryRun = await run(apply, a, '--dry-run');
    const shown = await run(status, a);

    expect(dryRun.output).toContain('+ create added');
    expect(shown.output).toContain('added: not installed');
    expect(dryRun.output).toContain('~ update changed');
    expect(shown.output).toContain('changed: out of date');
    expect(dryRun.output).toContain('= noop   same');
    expect(shown.output).toContain('same: in sync');
  });

  test('shows launchd state and log path', async () => {
    const a = await writeManifest('a', { one: job() });
    await run(apply, a);
    const { output } = await run(status, a);
    expect(output).toContain('launchd:   loaded, last exit 0');
    expect(output).toContain(join(deps.paths.logs, 'one.log'));
  });

  test('lists other jobs and how to remove unowned ones', async () => {
    await mkdir(deps.paths.launchAgents, { recursive: true });
    await writeFile(plistPath(deps.paths, 'dbgmw'), '<plist/>');
    const a = await writeManifest('a', {});

    const { code, output } = await run(status, a);

    expect(code).toBe(0);
    expect(output).toContain('dbgmw: unowned');
    expect(output).toContain('launchctl bootout gui/$(id -u)/com.ccron.dbgmw');
  });
});
