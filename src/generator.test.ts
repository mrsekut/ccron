import { describe, expect, test } from 'bun:test';
import type {
  AbsoluteDir,
  AbsoluteFile,
  Job,
  JobName,
  ManifestId,
  NonEmptyString,
} from './domain';
import {
  generatePlistContent,
  generateScriptContent,
  type RenderEnv,
} from './generator';
import { defaultPaths } from './paths';
import type { CalendarInterval } from './schedule';

const env: RenderEnv = {
  manifestId: '/Users/test/autowork/ccron/ccron.json' as ManifestId,
  claudeDir: '/Users/test/.nix-profile/bin',
  home: '/Users/test',
  paths: defaultPaths('/Users/test'),
};

const dailyIntervals: CalendarInterval[] = [{ Hour: 9, Minute: 0 }];

type JobOverrides = {
  prompt?: string;
  cwd?: string;
  mcpConfig?: string;
  intervals?: CalendarInterval[];
};

function makeJob(overrides: JobOverrides = {}): Job {
  const job: Job = {
    name: 'test-job' as JobName,
    schedule: {
      expression: '0 9 * * *',
      intervals: overrides.intervals ?? dailyIntervals,
    },
    prompt: (overrides.prompt ?? 'Hello world') as NonEmptyString,
    cwd: (overrides.cwd ?? '/Users/test/src/myproject') as AbsoluteDir,
  };
  if (overrides.mcpConfig !== undefined)
    job.mcpConfig = overrides.mcpConfig as AbsoluteFile;
  return job;
}

/** Run the generated script's quoting through bash to see what it means. */
async function bashValue(script: string, variable: string): Promise<string> {
  const line = script.split('\n').find(l => l.startsWith(`${variable}=`));
  if (!line) throw new Error(`${variable} not found`);
  const result = await Bun.$`bash -c ${`${line}; printf %s "$${variable}"`}`
    .quiet()
    .text();
  return result;
}

describe('generateScriptContent', () => {
  test('basic script', () => {
    const script = generateScriptContent(makeJob(), env);
    expect(script).toContain('#!/usr/bin/env bash');
    expect(script).toContain('set -uo pipefail');
    expect(script).toContain("export HOME='/Users/test'");
    expect(script).toContain(
      'export PATH=\'/Users/test/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin\':"$PATH"',
    );
    expect(script).toContain('ulimit -n 2147483646');
    expect(script).toContain("cd '/Users/test/src/myproject' || exit 1");
    expect(script).toContain("PROMPT='Hello world'");
    expect(script).toContain('claude -p "$PROMPT"');
  });

  test('prompt with single quotes survives bash', async () => {
    const prompt = `it's "quoted" $HOME \`x\``;
    const script = generateScriptContent(makeJob({ prompt }), env);
    expect(await bashValue(script, 'PROMPT')).toBe(prompt);
  });

  test('cwd with spaces and quotes is quoted', () => {
    const script = generateScriptContent(
      makeJob({ cwd: "/Users/test/my project/it's" }),
      env,
    );
    expect(script).toContain(`cd '/Users/test/my project/it'\\''s' || exit 1`);
  });

  test('mcp-config with spaces is quoted', () => {
    const script = generateScriptContent(
      makeJob({ mcpConfig: '/Users/test/my dir/mcp.json' }),
      env,
    );
    expect(script).toContain("--mcp-config '/Users/test/my dir/mcp.json'");
  });

  test('no mcp-config flag when absent', () => {
    const script = generateScriptContent(makeJob(), env);
    expect(script).not.toContain('--mcp-config');
  });

  test('is valid bash', async () => {
    const script = generateScriptContent(
      makeJob({ prompt: "a'b", mcpConfig: '/x y/m.json' }),
      env,
    );
    const result = await Bun.$`bash -n -c ${script}`.quiet().nothrow();
    expect(result.exitCode).toBe(0);
  });
});

describe('generatePlistContent', () => {
  test('basic plist structure', () => {
    const plist = generatePlistContent(makeJob(), env);
    expect(plist).toContain('<?xml version="1.0"');
    expect(plist).toContain('<key>Label</key>');
    expect(plist).toContain('com.ccron.test-job');
    expect(plist).toContain('/bin/bash');
    expect(plist).toContain(
      '<string>/Users/test/.local/bin/ccron-test-job.sh</string>',
    );
  });

  test('records the owning manifest', () => {
    const plist = generatePlistContent(makeJob(), env);
    expect(plist).toContain(
      '<key>CCRON_MANIFEST</key>\n        <string>/Users/test/autowork/ccron/ccron.json</string>',
    );
  });

  test('WorkingDirectory stays /tmp even when cwd is set', () => {
    // launchd does this chdir itself, and it is denied under TCC-protected paths.
    // The script's own `cd` is what honors cwd.
    const plist = generatePlistContent(makeJob(), env);
    expect(plist).toContain(
      '<key>WorkingDirectory</key>\n    <string>/tmp</string>',
    );
    expect(plist).not.toContain('/Users/test/src/myproject');
  });

  test('single calendar interval (no array wrapper)', () => {
    const plist = generatePlistContent(makeJob(), env);
    expect(plist).toContain('<key>Hour</key>');
    expect(plist).toContain('<integer>9</integer>');
    expect(plist).toContain('<key>Minute</key>');
    expect(plist).toContain('<integer>0</integer>');
    const calSection = plist.split('StartCalendarInterval')[1]!;
    expect(calSection).not.toContain('<array>');
  });

  test('multiple calendar intervals (array wrapper)', () => {
    const plist = generatePlistContent(
      makeJob({
        intervals: [
          { Hour: 17, Minute: 15, Weekday: 1 },
          { Hour: 17, Minute: 15, Weekday: 2 },
        ],
      }),
      env,
    );
    const calSection = plist.split('StartCalendarInterval')[1]!;
    expect(calSection).toContain('<array>');
    expect(calSection).toContain('<key>Weekday</key>');
  });

  test('log paths are set', () => {
    const plist = generatePlistContent(makeJob(), env);
    expect(plist).toContain('StandardOutPath');
    expect(plist).toContain('StandardErrorPath');
    expect(plist).toContain('/Users/test/.local/share/ccron/logs/test-job.log');
  });

  test('is a valid plist', async () => {
    const plist = generatePlistContent(
      makeJob({ mcpConfig: '/a & b/<m>.json' }),
      env,
    );
    const result = await Bun.$`plutil -lint - < ${new Response(plist)}`
      .quiet()
      .nothrow();
    expect(result.exitCode).toBe(0);
  });
});
