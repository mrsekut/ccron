import { describe, expect, test } from 'bun:test';
import {
  absoluteDir,
  absoluteFile,
  jobName,
  manifestId,
  nonEmptyString,
} from './domain';

describe('jobName', () => {
  test('accepts lowercase letters, digits and hyphens', () => {
    expect(jobName('member-watch').ok).toBe(true);
    expect(jobName('0day').ok).toBe(true);
  });

  test('accepts exactly 64 characters', () => {
    expect(jobName('a'.repeat(64)).ok).toBe(true);
  });

  test('rejects 65 characters', () => {
    expect(jobName('a'.repeat(65)).ok).toBe(false);
  });

  test.each(['', '-leading', 'Upper', 'under_score', 'sp ace', 'dot.name'])(
    'rejects %p',
    input => {
      expect(jobName(input).ok).toBe(false);
    },
  );
});

describe('nonEmptyString', () => {
  test('accepts text', () => {
    expect(nonEmptyString('hello').ok).toBe(true);
  });

  test.each(['', '   ', '\n'])('rejects %p', input => {
    expect(nonEmptyString(input).ok).toBe(false);
  });
});

describe('absoluteDir', () => {
  test('accepts an existing absolute directory', () => {
    expect(absoluteDir('/Users/test/src', 'directory').ok).toBe(true);
  });

  test('rejects a relative path', () => {
    expect(absoluteDir('src', 'directory').ok).toBe(false);
  });

  test('rejects a missing path', () => {
    expect(absoluteDir('/nope', 'missing').ok).toBe(false);
  });

  test('rejects a file', () => {
    expect(absoluteDir('/Users/test/a.json', 'file').ok).toBe(false);
  });
});

describe('absoluteFile', () => {
  test('accepts an existing absolute file', () => {
    expect(absoluteFile('/Users/test/mcp.json', 'file').ok).toBe(true);
  });

  test('rejects a directory', () => {
    expect(absoluteFile('/Users/test', 'directory').ok).toBe(false);
  });

  test('rejects a missing path', () => {
    expect(absoluteFile('/Users/test/mcp.json', 'missing').ok).toBe(false);
  });
});

describe('manifestId', () => {
  test('accepts an absolute path', () => {
    expect(manifestId('/Users/test/ccron.json').ok).toBe(true);
  });

  test('rejects a relative path', () => {
    expect(manifestId('ccron.json').ok).toBe(false);
  });
});
