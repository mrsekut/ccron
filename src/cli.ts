#!/usr/bin/env bun

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`ccron - Schedule claude -p execution on macOS with launchd

Usage: ccron <command> [options]

Commands:
  add       Register a new scheduled task
  list      List all registered tasks
  run       Manually run a task
  test      Run environment checks for a task
  log       Show task logs
  auth      Re-authenticate MCP for a task
  remove    Remove a registered task
  edit      Edit a task's configuration

Options:
  --help    Show help for a command

Examples:
  ccron add --name daily-summary --schedule "15 17 * * 1-5" --prompt-file ./prompts/daily.txt
  ccron add --name weekly-review --schedule "0 22 * * 5" --prompt "週次レビューを作成して" --mcp slack
  ccron list
  ccron run daily-summary
  ccron test daily-summary
  ccron log daily-summary --follow
  ccron remove daily-summary`);
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

const commands: Record<string, (args: string[]) => Promise<void>> = {
  add: addCommand,
  list: listCommand,
  run: runCommand,
  log: logCommand,
  test: testCommand,
};

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  console.error('Run "ccron --help" for usage.');
  process.exit(1);
}

await handler(args.slice(1));
