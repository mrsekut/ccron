import { test, expect, describe } from "bun:test";
import {
  generateScriptContent,
  generatePlistContent,
  generateMcpConfigContent,
} from "./generator";
import type { TaskConfig, GlobalConfig } from "./config";
import type { CalendarInterval } from "./schedule";

const baseGlobal: GlobalConfig = {
  claudePath: "/Users/test/.nix-profile/bin",
  extraPaths: [],
  ulimit: 2147483646,
};

function makeTask(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    name: "test-task",
    schedule: "0 9 * * *",
    prompt: "Hello world",
    promptFile: null,
    mcp: [],
    allowedTools: [],
    maxTurns: null,
    createdAt: "2026-04-02T00:00:00Z",
    updatedAt: "2026-04-02T00:00:00Z",
    ...overrides,
  };
}

describe("generateScriptContent", () => {
  test("basic script with inline prompt", () => {
    const script = generateScriptContent(makeTask(), baseGlobal);
    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("set -uo pipefail");
    expect(script).toContain('export HOME=');
    expect(script).toContain("/Users/test/.nix-profile/bin");
    expect(script).toContain("ulimit -n 2147483646");
    expect(script).toContain("cd /tmp");
    expect(script).toContain("PROMPT='Hello world'");
    expect(script).toContain('claude -p "$PROMPT"');
  });

  test("prompt-file uses cat", () => {
    const script = generateScriptContent(
      makeTask({ prompt: null, promptFile: "/path/to/prompt.txt" }),
      baseGlobal,
    );
    expect(script).toContain('PROMPT=$(cat "/path/to/prompt.txt")');
    expect(script).not.toContain("PROMPT='");
  });

  test("prompt with single quotes is escaped", () => {
    const script = generateScriptContent(
      makeTask({ prompt: "it's a test" }),
      baseGlobal,
    );
    expect(script).toContain("PROMPT='it'\\''s a test'");
  });

  test("mcp config flag is included", () => {
    const script = generateScriptContent(
      makeTask({ mcp: ["slack"] }),
      baseGlobal,
    );
    expect(script).toContain("--mcp-config");
    expect(script).toContain("ccron/mcp/test-task.json");
  });

  test("allowed tools flag is included", () => {
    const script = generateScriptContent(
      makeTask({ allowedTools: ["Bash", "Read", "Write"] }),
      baseGlobal,
    );
    expect(script).toContain('--allowedTools "Bash,Read,Write"');
  });

  test("max-turns flag is included", () => {
    const script = generateScriptContent(
      makeTask({ maxTurns: 20 }),
      baseGlobal,
    );
    expect(script).toContain("--max-turns 20");
  });
});

describe("generatePlistContent", () => {
  const dailyIntervals: CalendarInterval[] = [{ Hour: 9, Minute: 0 }];

  test("basic plist structure", () => {
    const plist = generatePlistContent(makeTask(), baseGlobal, dailyIntervals);
    expect(plist).toContain('<?xml version="1.0"');
    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("com.ccron.test-task");
    expect(plist).toContain("/bin/bash");
    expect(plist).toContain("ccron-test-task.sh");
    expect(plist).toContain("<key>WorkingDirectory</key>");
    expect(plist).toContain("<string>/tmp</string>");
  });

  test("single calendar interval (no array wrapper)", () => {
    const plist = generatePlistContent(makeTask(), baseGlobal, dailyIntervals);
    expect(plist).toContain("<key>Hour</key>");
    expect(plist).toContain("<integer>9</integer>");
    expect(plist).toContain("<key>Minute</key>");
    expect(plist).toContain("<integer>0</integer>");
    // Single interval should use dict, not array
    const calSection = plist.split("StartCalendarInterval")[1]!;
    expect(calSection).not.toContain("<array>");
  });

  test("multiple calendar intervals (array wrapper)", () => {
    const weekdayIntervals: CalendarInterval[] = [
      { Hour: 17, Minute: 15, Weekday: 1 },
      { Hour: 17, Minute: 15, Weekday: 2 },
    ];
    const plist = generatePlistContent(
      makeTask(),
      baseGlobal,
      weekdayIntervals,
    );
    const calSection = plist.split("StartCalendarInterval")[1]!;
    expect(calSection).toContain("<array>");
    expect(calSection).toContain("<key>Weekday</key>");
  });

  test("log paths are set", () => {
    const plist = generatePlistContent(makeTask(), baseGlobal, dailyIntervals);
    expect(plist).toContain("StandardOutPath");
    expect(plist).toContain("StandardErrorPath");
    expect(plist).toContain("ccron/logs/test-task.log");
  });
});

describe("generateMcpConfigContent", () => {
  test("generates valid JSON with mcpServers", () => {
    const content = generateMcpConfigContent(["slack"]);
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.slack).toEqual({
      type: "http",
      url: "https://mcp.slack.com/mcp",
    });
  });

  test("multiple presets", () => {
    const content = generateMcpConfigContent(["slack", "linear"]);
    const parsed = JSON.parse(content);
    expect(Object.keys(parsed.mcpServers)).toEqual(["slack", "linear"]);
  });

  test("throws on unknown preset", () => {
    expect(() => generateMcpConfigContent(["unknown"])).toThrow();
  });
});
