import { test, expect, describe } from 'bun:test';
import {
  generateScriptContent,
  generatePlistContent,
} from './generator';
import type { TaskConfig, GlobalConfig } from './config';
import type { CalendarInterval } from './schedule';

const baseGlobal: GlobalConfig = {
  claudePath: '/Users/test/.nix-profile/bin',
  extraPaths: [],
  ulimit: 2147483646,
};

function makeTask(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    name: 'test-task',
    schedule: '0 9 * * *',
    prompt: 'Hello world',
    mcpConfig: null,
    createdAt: '2026-04-02T00:00:00Z',
    updatedAt: '2026-04-02T00:00:00Z',
    ...overrides,
  };
}

describe('generateScriptContent', () => {
  test('basic script with inline prompt', () => {
    const script = generateScriptContent(makeTask(), baseGlobal);
    expect(script).toContain('#!/usr/bin/env bash');
    expect(script).toContain('set -uo pipefail');
    expect(script).toContain('export HOME=');
    expect(script).toContain('/Users/test/.nix-profile/bin');
    expect(script).toContain('ulimit -n 2147483646');
    expect(script).toContain('cd /tmp');
    expect(script).toContain("PROMPT='Hello world'");
    expect(script).toContain('claude -p "$PROMPT"');
  });

  test('prompt with single quotes is escaped', () => {
    const script = generateScriptContent(
      makeTask({ prompt: "it's a test" }),
      baseGlobal,
    );
    expect(script).toContain("PROMPT='it'\\''s a test'");
  });

  test('mcp-config flag is included', () => {
    const script = generateScriptContent(
      makeTask({ mcpConfig: '/path/to/mcp.json' }),
      baseGlobal,
    );
    expect(script).toContain('--mcp-config "/path/to/mcp.json"');
  });

  test('no mcp-config flag when null', () => {
    const script = generateScriptContent(makeTask(), baseGlobal);
    expect(script).not.toContain('--mcp-config');
  });
});

describe('generatePlistContent', () => {
  const dailyIntervals: CalendarInterval[] = [{ Hour: 9, Minute: 0 }];

  test('basic plist structure', () => {
    const plist = generatePlistContent(makeTask(), baseGlobal, dailyIntervals);
    expect(plist).toContain('<?xml version="1.0"');
    expect(plist).toContain('<key>Label</key>');
    expect(plist).toContain('com.ccron.test-task');
    expect(plist).toContain('/bin/bash');
    expect(plist).toContain('ccron-test-task.sh');
    expect(plist).toContain('<key>WorkingDirectory</key>');
    expect(plist).toContain('<string>/tmp</string>');
  });

  test('single calendar interval (no array wrapper)', () => {
    const plist = generatePlistContent(makeTask(), baseGlobal, dailyIntervals);
    expect(plist).toContain('<key>Hour</key>');
    expect(plist).toContain('<integer>9</integer>');
    expect(plist).toContain('<key>Minute</key>');
    expect(plist).toContain('<integer>0</integer>');
    // Single interval should use dict, not array
    const calSection = plist.split('StartCalendarInterval')[1]!;
    expect(calSection).not.toContain('<array>');
  });

  test('multiple calendar intervals (array wrapper)', () => {
    const weekdayIntervals: CalendarInterval[] = [
      { Hour: 17, Minute: 15, Weekday: 1 },
      { Hour: 17, Minute: 15, Weekday: 2 },
    ];
    const plist = generatePlistContent(
      makeTask(),
      baseGlobal,
      weekdayIntervals,
    );
    const calSection = plist.split('StartCalendarInterval')[1]!;
    expect(calSection).toContain('<array>');
    expect(calSection).toContain('<key>Weekday</key>');
  });

  test('log paths are set', () => {
    const plist = generatePlistContent(makeTask(), baseGlobal, dailyIntervals);
    expect(plist).toContain('StandardOutPath');
    expect(plist).toContain('StandardErrorPath');
    expect(plist).toContain('ccron/logs/test-task.log');
  });
});
