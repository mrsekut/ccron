#!/usr/bin/env bun

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`ccron - Schedule claude -p execution on macOS with launchd

Automates launchd setup for running claude -p on a schedule, handling all
macOS-specific workarounds (environment variables, TCC, ulimit, keychain).

Usage: ccron <command> [options]

Commands:
  add       Register a new scheduled task
  list      List all registered tasks with launchd status
  run       Manually trigger a task and tail its log
  test      Run environment checks (CLI, auth, ulimit, TCC, plist)
  log       Show task execution logs
  auth      Re-authenticate MCP servers for a task
  edit      Edit a task's configuration (regenerates script/plist)
  remove    Remove a task and all generated files

Schedule format (cron expression):
  "minute hour * * day-of-week"

  15 17 * * *     Every day at 17:15
  15 17 * * 1-5   Weekdays at 17:15
  0 22 * * 5      Every Friday at 22:00
  0 9 * * 1,3,5   Mon/Wed/Fri at 9:00

  Note: Step values (*/5) and minute/hour ranges are not supported (launchd limitation).

MCP presets: slack, linear

File locations:
  Task configs:  ~/.config/ccron/tasks/<name>.json
  MCP configs:   ~/.config/ccron/mcp/<name>.json
  Scripts:       ~/.local/bin/ccron-<name>.sh
  Plists:        ~/Library/LaunchAgents/com.ccron.<name>.plist
  Logs:          ~/.local/share/ccron/logs/<name>.log

Examples:
  ccron add --name daily-summary --schedule "15 17 * * 1-5" --prompt-file ./prompts/daily.txt
  ccron add --name weekly-review --schedule "0 22 * * 5" --prompt "週次レビュー" --mcp slack
  ccron list
  ccron test daily-summary
  ccron edit daily-summary --schedule "0 18 * * 1-5"
  ccron run daily-summary
  ccron log daily-summary --follow
  ccron remove daily-summary

Run "ccron <command> --help" for detailed help on each command.`);
}

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

import { addCommand } from "./commands/add";
import { listCommand } from "./commands/list";
import { runCommand } from "./commands/run";
import { logCommand } from "./commands/log";
import { testCommand } from "./commands/test";
import { removeCommand } from "./commands/remove";
import { editCommand } from "./commands/edit";
import { authCommand } from "./commands/auth";

const commands: Record<string, (args: string[]) => Promise<void>> = {
  add: addCommand,
  list: listCommand,
  run: runCommand,
  log: logCommand,
  test: testCommand,
  remove: removeCommand,
  edit: editCommand,
  auth: authCommand,
};

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  console.error('Run "ccron --help" for usage.');
  process.exit(1);
}

await handler(args.slice(1));
