import { describe, expect, test } from 'bun:test';
import type { ManifestId, PathKind } from './domain';
import { parseManifest, type ParseContext } from './manifest';

const id = '/Users/test/autowork/ccron/ccron.json' as ManifestId;

function context(kinds: Record<string, PathKind> = {}): ParseContext {
  return {
    home: '/Users/test',
    pathKind: path => kinds[path] ?? 'missing',
  };
}

const defaultKinds: Record<string, PathKind> = {
  '/Users/test/autowork': 'directory',
  '/Users/test/autowork/ccron/mcp/slack.json': 'file',
};

function job(overrides: Record<string, unknown> = {}) {
  return {
    schedule: '0 17 * * 1-5',
    prompt: 'member-watch スキルを実行して',
    cwd: '..',
    ...overrides,
  };
}

function parse(raw: unknown, kinds: Record<string, PathKind> = defaultKinds) {
  return parseManifest(raw, id, context(kinds));
}

function errorsOf(raw: unknown, kinds?: Record<string, PathKind>) {
  const result = parse(raw, kinds);
  if (result.ok) throw new Error('expected errors');
  return result.error;
}

describe('parseManifest', () => {
  test('valid manifest', () => {
    const result = parse({
      jobs: {
        'member-watch': job({ mcpConfig: 'mcp/slack.json' }),
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [parsed] = result.value.jobs;
    expect(parsed?.name as string | undefined).toBe('member-watch');
    expect(parsed?.schedule.expression).toBe('0 17 * * 1-5');
    expect(parsed?.schedule.intervals).toHaveLength(5);
  });

  test('resolves relative paths against the manifest directory', () => {
    const result = parse({
      jobs: { a: job({ mcpConfig: 'mcp/slack.json' }) },
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.jobs[0]?.cwd as string | undefined).toBe(
      '/Users/test/autowork',
    );
    expect(result.value.jobs[0]?.mcpConfig as string | undefined).toBe(
      '/Users/test/autowork/ccron/mcp/slack.json',
    );
  });

  test('keeps absolute paths as they are', () => {
    const result = parse(
      { jobs: { a: job({ cwd: '/Users/test/other' }) } },
      { '/Users/test/other': 'directory' },
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.jobs[0]?.cwd as string | undefined).toBe(
      '/Users/test/other',
    );
  });

  test('mcpConfig is optional', () => {
    const result = parse({ jobs: { a: job() } });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.jobs[0]?.mcpConfig).toBeUndefined();
  });

  test('empty jobs is valid', () => {
    expect(parse({ jobs: {} }).ok).toBe(true);
  });

  test('rejects an empty prompt', () => {
    expect(errorsOf({ jobs: { a: job({ prompt: '' }) } })).toEqual([
      { job: 'a', field: 'prompt', message: 'must not be empty' },
    ]);
  });

  test('turns a schedule parse error into a validation error', () => {
    const [error] = errorsOf({ jobs: { a: job({ schedule: '*/5 * * * *' }) } });
    expect(error?.job).toBe('a');
    expect(error?.field).toBe('schedule');
  });

  test('rejects a missing cwd directory', () => {
    const [error] = errorsOf({ jobs: { a: job() } }, {});
    expect(error?.field).toBe('cwd');
    expect(error?.message).toContain('does not exist');
  });

  test('cwd is required', () => {
    const { cwd: _, ...withoutCwd } = job();
    expect(errorsOf({ jobs: { a: withoutCwd } })).toEqual([
      { job: 'a', field: 'cwd', message: 'is required' },
    ]);
  });

  test.each([
    '/Users/test/Documents/project',
    '/Users/test/Desktop',
    '/Users/test/Downloads/x',
  ])('rejects cwd under TCC protection: %p', cwd => {
    const [error] = errorsOf(
      { jobs: { a: job({ cwd }) } },
      { [cwd]: 'directory' },
    );
    expect(error?.field).toBe('cwd');
    expect(error?.message).toContain('TCC');
  });

  test('does not treat a sibling with a TCC-like prefix as protected', () => {
    const cwd = '/Users/test/Documentsx';
    expect(
      parse({ jobs: { a: job({ cwd }) } }, { [cwd]: 'directory' }).ok,
    ).toBe(true);
  });

  test('rejects a missing mcpConfig file', () => {
    const [error] = errorsOf({
      jobs: { a: job({ mcpConfig: 'mcp/missing.json' }) },
    });
    expect(error?.field).toBe('mcpConfig');
  });

  test('rejects an invalid job name', () => {
    const [error] = errorsOf({ jobs: { Bad_Name: job() } });
    expect(error?.job).toBe('Bad_Name');
    expect(error?.field).toBeUndefined();
  });

  test('rejects unknown keys to catch typos', () => {
    expect(errorsOf({ jobs: { a: job({ mcpconfig: 'x' }) } })).toEqual([
      { job: 'a', field: 'mcpconfig', message: 'unknown key "mcpconfig"' },
    ]);
    expect(errorsOf({ jobs: {}, job: {} })).toEqual([
      { message: 'unknown key "job"' },
    ]);
  });

  test('rejects non-string fields', () => {
    expect(errorsOf({ jobs: { a: job({ prompt: 1 }) } })).toEqual([
      { job: 'a', field: 'prompt', message: 'must be a string' },
    ]);
  });

  test('rejects a manifest without jobs', () => {
    expect(errorsOf({})).toEqual([
      { field: 'jobs', message: '"jobs" must be an object' },
    ]);
    expect(errorsOf([])).toEqual([{ message: 'manifest must be an object' }]);
  });

  test('collects every error instead of stopping at the first', () => {
    const errors = errorsOf({
      jobs: {
        a: job({ prompt: '', schedule: 'nope' }),
        b: job({ cwd: '/missing' }),
      },
    });
    expect(errors.map(e => `${e.job}.${e.field}`).sort()).toEqual([
      'a.prompt',
      'a.schedule',
      'b.cwd',
    ]);
  });
});
