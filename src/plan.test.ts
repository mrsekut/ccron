import { describe, expect, test } from 'bun:test';
import type {
  AbsoluteDir,
  ActualJob,
  Artifacts,
  Job,
  JobName,
  Manifest,
  ManifestId,
  NonEmptyString,
  Owner,
} from './domain';
import { render, type RenderEnv } from './generator';
import { defaultPaths } from './paths';
import { actionName, plan } from './plan';

const mine = '/Users/test/autowork/ccron/ccron.json' as ManifestId;
const theirs = '/Users/test/dotfiles/ccron.json' as ManifestId;

const env: RenderEnv = {
  manifestId: mine,
  claudeDir: '/Users/test/.nix-profile/bin',
  home: '/Users/test',
  paths: defaultPaths('/Users/test'),
};

function job(name: string, prompt = 'hello'): Job {
  return {
    name: name as JobName,
    schedule: { expression: '0 9 * * *', intervals: [{ Hour: 9, Minute: 0 }] },
    prompt: prompt as NonEmptyString,
    cwd: '/Users/test/autowork' as AbsoluteDir,
  };
}

function manifest(...jobs: Job[]): Manifest {
  return { id: mine, jobs };
}

/** An installed job whose files match what `declared` would render. */
function installed(
  declared: Job,
  owner: Owner = { kind: 'mine' },
  overrides: { artifacts?: Artifacts; loaded?: boolean } = {},
): ActualJob {
  const rendered = render(declared, env);
  return {
    name: declared.name,
    owner,
    artifacts: overrides.artifacts ?? { kind: 'complete', ...rendered },
    loaded: overrides.loaded ?? true,
  };
}

function kinds(m: Manifest, actual: ActualJob[]): [string, string][] {
  const result = plan(m, actual, env);
  if (!result.ok) throw new Error(`conflicts: ${JSON.stringify(result.error)}`);
  return result.value.actions.map(a => [a.kind, actionName(a)]);
}

describe('plan', () => {
  test('declared only → create', () => {
    expect(kinds(manifest(job('a')), [])).toEqual([['create', 'a']]);
  });

  test('both, in sync → noop', () => {
    expect(kinds(manifest(job('a')), [installed(job('a'))])).toEqual([
      ['noop', 'a'],
    ]);
  });

  test('both, content differs → update', () => {
    expect(
      kinds(manifest(job('a', 'new prompt')), [installed(job('a', 'old'))]),
    ).toEqual([['update', 'a']]);
  });

  test('both, in sync but not loaded in launchd → update', () => {
    expect(
      kinds(manifest(job('a')), [
        installed(job('a'), undefined, { loaded: false }),
      ]),
    ).toEqual([['update', 'a']]);
  });

  test('plist without script (partial) → update', () => {
    const partial = installed(job('a'), undefined, {
      artifacts: { kind: 'partial', plist: render(job('a'), env).plist },
    });
    expect(kinds(manifest(job('a')), [partial])).toEqual([['update', 'a']]);
  });

  test('installed only, mine → delete', () => {
    expect(kinds(manifest(), [installed(job('a'))])).toEqual([['delete', 'a']]);
  });

  test.each<Owner>([
    { kind: 'other', manifest: theirs },
    { kind: 'orphan', manifest: '/gone/ccron.json' },
    { kind: 'unowned' },
  ])('installed only, not mine → left alone (%p)', owner => {
    expect(kinds(manifest(), [installed(job('a'), owner)])).toEqual([]);
  });

  test('same name, unowned → adopt', () => {
    expect(
      kinds(manifest(job('a')), [installed(job('a'), { kind: 'unowned' })]),
    ).toEqual([['adopt', 'a']]);
  });

  test.each<Owner>([
    { kind: 'other', manifest: theirs },
    { kind: 'orphan', manifest: '/gone/ccron.json' },
  ])('same name, owned elsewhere → conflict (%p)', owner => {
    const result = plan(
      manifest(job('a'), job('b')),
      [installed(job('a'), owner)],
      env,
    );
    expect(result).toEqual({
      ok: false,
      error: [{ name: 'a' as JobName, owner }],
    });
  });

  test('actions are sorted by name', () => {
    expect(kinds(manifest(job('c'), job('a')), [installed(job('b'))])).toEqual([
      ['create', 'a'],
      ['delete', 'b'],
      ['create', 'c'],
    ]);
  });

  test('writing actions carry the rendered files', () => {
    const result = plan(manifest(job('a')), [], env);
    if (!result.ok) throw new Error('unexpected conflict');
    expect(result.value.actions[0]).toEqual({
      kind: 'create',
      job: job('a'),
      rendered: render(job('a'), env),
    });
  });
});
