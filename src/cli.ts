#!/usr/bin/env bun

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`ccron - Schedule claude -p execution on macOS with launchd

Usage: ccron <command> [options]

Commands:
  run       Manually trigger a job and tail its log

File locations:
  Scripts:       ~/.local/bin/ccron-<name>.sh
  Plists:        ~/Library/LaunchAgents/com.ccron.<name>.plist
  Logs:          ~/.local/share/ccron/logs/<name>.log

Run "ccron <command> --help" for detailed help on each command.`);
}

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

import { runCommand } from './commands/run';

const commands: Record<string, (args: string[]) => Promise<void>> = {
  run: runCommand,
};

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  console.error('Run "ccron --help" for usage.');
  process.exit(1);
}

await handler(args.slice(1));
