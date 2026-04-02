#!/usr/bin/env bun

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`cccron - Schedule claude -p execution on macOS with launchd

Schedule claude -p execution on macOS via launchd.
Handles all the tricky launchd setup automatically.

Usage: cccron <command> [options]

Commands:
  add       Register a new scheduled task
  list      List all registered tasks with launchd status
  show      Show detailed information about a task
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
  Task configs:  ~/.config/cccron/tasks/<name>.json
  MCP configs:   ~/.config/cccron/mcp/<name>.json
  Scripts:       ~/.local/bin/cccron-<name>.sh
  Plists:        ~/Library/LaunchAgents/com.cccron.<name>.plist
  Logs:          ~/.local/share/cccron/logs/<name>.log

Examples:
  cccron add --name daily-summary --schedule "15 17 * * 1-5" --prompt-file ./prompts/daily.txt
  cccron add --name weekly-review --schedule "0 22 * * 5" --prompt "週次レビュー" --mcp slack
  cccron list
  cccron show daily-summary
  cccron test daily-summary
  cccron edit daily-summary --schedule "0 18 * * 1-5"
  cccron run daily-summary
  cccron log daily-summary --follow
  cccron remove daily-summary

Run "cccron <command> --help" for detailed help on each command.`);
}

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

import { addCommand } from './commands/add';
import { listCommand } from './commands/list';
import { runCommand } from './commands/run';
import { logCommand } from './commands/log';
import { testCommand } from './commands/test';
import { removeCommand } from './commands/remove';
import { editCommand } from './commands/edit';
import { authCommand } from './commands/auth';
import { showCommand } from './commands/show';

const commands: Record<string, (args: string[]) => Promise<void>> = {
  add: addCommand,
  list: listCommand,
  show: showCommand,
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
  console.error('Run "cccron --help" for usage.');
  process.exit(1);
}

await handler(args.slice(1));
