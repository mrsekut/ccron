#!/usr/bin/env bun

import { homedir } from 'os';
import { apply } from './commands/apply';
import { runCommand } from './commands/run';
import { status } from './commands/status';
import { systemLaunchd } from './launchd';
import { defaultPaths } from './paths';
import { findClaudeDirOnPath, type Deps } from './workflow';

const HELP = `ccron - Schedule claude -p execution on macOS with launchd

Declare jobs in a ccron.json and let ccron make launchd match it.

Usage: ccron <command> [options]

Commands:
  apply <ccron.json> [--dry-run]   Make launchd match the manifest
  status <ccron.json>              Show sync state, launchd status and logs
  run <name>                       Trigger a job now and tail its log

ccron.json:
  {
    "jobs": {
      "member-watch": {
        "schedule": "0 17 * * 1-5",
        "prompt": "member-watch スキルを実行して",
        "cwd": "..",
        "mcpConfig": "mcp/slack.json"
      }
    }
  }

  cwd and mcpConfig are resolved against the manifest's directory.
  cwd is required; mcpConfig is optional.

Schedule format (cron expression):
  "minute hour * * day-of-week"

  15 17 * * *     Every day at 17:15
  15 17 * * 1-5   Weekdays at 17:15
  0 9 * * 1,3,5   Mon/Wed/Fri at 9:00

  Step values (*/5) and minute/hour ranges are not supported (launchd limitation).

File locations:
  Scripts:       ~/.local/bin/ccron-<name>.sh
  Plists:        ~/Library/LaunchAgents/com.ccron.<name>.plist
  Logs:          ~/.local/share/ccron/logs/<name>.log

Run "ccron <command> --help" for detailed help on each command.`;

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(HELP);
  process.exit(0);
}

const home = homedir();
const deps: Deps = {
  home,
  paths: defaultPaths(home),
  launchd: systemLaunchd,
  findClaudeDir: findClaudeDirOnPath,
};
const out = (line: string) => console.log(line);

switch (command) {
  case 'apply':
    process.exit(await apply(args.slice(1), deps, out));
  case 'status':
    process.exit(await status(args.slice(1), deps, out));
  case 'run':
    await runCommand(args.slice(1));
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Run "ccron --help" for usage.');
    process.exit(1);
}
