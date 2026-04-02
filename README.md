# cccron

Schedule `claude -p` execution on macOS with launchd.

Register scheduled `claude -p` tasks with a single command. Handles all the tricky launchd setup automatically.

## Usage

Run directly with `bunx`:

```bash
bunx cccron <command> [options]
```

## Claude Code Skill

Install the cccron skill so Claude Code can register tasks from natural language:

```bash
bunx skills add mrsekut/cccron
```

Then tell Claude: "Schedule a daily summary to Slack at 5pm on weekdays" and it will handle the rest.

## Quick Start

```bash
# Register a task
cccron add \
  --name daily-summary \
  --schedule "15 17 * * 1-5" \
  --prompt-file ./prompts/daily-summary.txt \
  --mcp slack

# Verify setup
cccron test daily-summary

# List all tasks
cccron list
```

## Commands

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `cccron add`           | Register a new scheduled task      |
| `cccron list`          | List tasks with launchd status     |
| `cccron show <name>`   | Show detailed task info            |
| `cccron run <name>`    | Manually trigger and tail log      |
| `cccron test <name>`   | Run environment checks             |
| `cccron log <name>`    | Show logs (`--follow` for tail)    |
| `cccron edit <name>`   | Edit config, regenerate and reload |
| `cccron auth <name>`   | Re-authenticate MCP servers        |
| `cccron remove <name>` | Remove task (`--purge` for logs)   |

## Schedule Format

Standard cron expression: `"minute hour * * day-of-week"`

```
15 17 * * *     Every day at 17:15
15 17 * * 1-5   Weekdays at 17:15
0 22 * * 5      Every Friday at 22:00
0 9 * * 1,3,5   Mon/Wed/Fri at 9:00
```

Step values (`*/5`) and minute/hour ranges are not supported (launchd limitation).

## MCP Presets

`slack`, `linear` are available as built-in presets.

```bash
cccron add --name my-task --schedule "0 9 * * *" --prompt "hello" --mcp slack,linear
```
