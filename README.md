# ccron

Schedule `claude -p` execution on macOS with launchd.

Register scheduled `claude -p` tasks with a single command. Handles all the tricky launchd setup automatically.

## Usage

Run directly with `bunx`:

```bash
bunx @mrsekut/ccron <command> [options]
```

## Claude Code Skill

Install the ccron skill so Claude Code can register tasks from natural language:

```bash
bunx skills add mrsekut/ccron
```

Then tell Claude: "Schedule a daily summary to Slack at 5pm on weekdays" and it will handle the rest.

## Quick Start

```bash
# Register a task
ccron add \
  --name daily-summary \
  --schedule "15 17 * * 1-5" \
  --prompt "日次サマリーを作成して #daily-summary チャンネルに投稿して" \
  --mcp-config ~/mcp.json \
  --cwd ~/src/myproject

# Verify setup
ccron test daily-summary

# List all tasks
ccron list
```

## Commands

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `ccron add`           | Register a new scheduled task      |
| `ccron list`          | List tasks with launchd status     |
| `ccron show <name>`   | Show detailed task info            |
| `ccron run <name>`    | Manually trigger and tail log      |
| `ccron test <name>`   | Run environment checks             |
| `ccron log <name>`    | Show logs (`--follow` for tail)    |
| `ccron edit <name>`   | Edit config, regenerate and reload |
| `ccron auth <name>`   | Re-authenticate MCP servers        |
| `ccron remove <name>` | Remove task and logs               |

## Schedule Format

Standard cron expression: `"minute hour * * day-of-week"`

```
15 17 * * *     Every day at 17:15
15 17 * * 1-5   Weekdays at 17:15
0 22 * * 5      Every Friday at 22:00
0 9 * * 1,3,5   Mon/Wed/Fri at 9:00
```

Step values (`*/5`) and minute/hour ranges are not supported (launchd limitation).

## Working Directory

Tasks run in `/tmp` by default. Pass `--cwd` to run in a project directory instead:

```bash
ccron add --name my-task --schedule "0 9 * * *" --prompt "hello" --cwd ~/src/myproject
```

This matters for more than file access. `claude` picks up its project context from the
directory it starts in, so with `--cwd` the task can also use that project's
`CLAUDE.md`, `.claude/skills/` and `.mcp.json`.

That makes it possible to keep the prompt itself in the project as a skill, and have the
task be a one-liner that invokes it:

```bash
ccron add --name member-watch --schedule "0 17 * * 1-5" \
  --prompt "/member-watch を実行して" \
  --cwd ~/src/myproject
```

The prompt then lives under version control, and manual runs and scheduled runs share the
same definition. Without `--cwd`, a task cannot read files outside `/tmp` — it will fail
with a permission error rather than a missing-file error.

## MCP

Pass your own MCP config JSON file via `--mcp-config`:

```bash
ccron add --name my-task --schedule "0 9 * * *" --prompt "hello" --mcp-config ~/mcp.json
```
