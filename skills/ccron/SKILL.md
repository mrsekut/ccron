---
name: ccron
description: >
  Schedule claude -p execution on macOS with launchd. Use when the user wants to
  set up recurring claude tasks, manage scheduled prompts, or automate claude CLI runs.
allowed-tools: 'Read,Write,Bash(ccron:*)'
version: '0.1.0'
author: 'mrsekut'
---

# ccron - Schedule claude -p on macOS with launchd

Schedule `claude -p` on macOS via launchd. Handles all the tricky launchd setup automatically.

## Workflow

When a user asks to run something on a schedule:

1. Create a prompt file (`./prompts/<name>.txt` or similar, git-manageable location)
2. Register with `ccron add`
3. Verify with `ccron test <name>`

**Always run `ccron <command> --help` to check the latest options.**

## Commands

| Command               | Purpose                              |
| --------------------- | ------------------------------------ |
| `ccron add`           | Register a scheduled task            |
| `ccron list`          | List tasks with launchd status       |
| `ccron show <name>`   | Show detailed task info              |
| `ccron run <name>`    | Manually trigger and tail log        |
| `ccron test <name>`   | Run environment checks               |
| `ccron log <name>`    | Show logs (`--follow` for tail)      |
| `ccron auth <name>`   | Re-authenticate MCP servers          |
| `ccron edit <name>`   | Edit config, regenerate and reload   |
| `ccron remove <name>` | Remove task and logs                 |

## ccron add Options

```
--name <name>           Task name (lowercase, numbers, hyphens)
--schedule "<cron>"     Cron expression: "minute hour * * day-of-week"
--prompt "<text>"       Prompt string (mutually exclusive with --prompt-file)
--prompt-file <path>    Prompt file path (mutually exclusive with --prompt)
--mcp <names>           MCP presets, comma-separated (slack, linear)
--allowed-tools <tools> Allowed tools (Bash,Read,Write,Edit,Glob,Grep)
```

## Schedule (cron)

Format: `"minute hour * * day-of-week"` (5 fields)

| Goal                  | Cron              |
| --------------------- | ----------------- |
| Daily at 17:15        | `"15 17 * * *"`   |
| Weekdays at 17:15     | `"15 17 * * 1-5"` |
| Every Friday at 22:00 | `"0 22 * * 5"`    |
| Mon/Wed/Fri at 9:00   | `"0 9 * * 1,3,5"` |

**Constraint**: Step values (`*/5`) and minute/hour ranges are not supported (launchd limitation).

## Example

User: "Post a daily summary to Slack at 5pm on weekdays"

```bash
# 1. Create prompt file
cat > ./prompts/daily-summary.txt << 'EOF'
Create a daily summary and post it to #daily-summary channel.
Include: completed tasks, tomorrow's plan, blockers.
EOF

# 2. Register
ccron add \
  --name daily-summary \
  --schedule "0 17 * * 1-5" \
  --prompt-file ./prompts/daily-summary.txt \
  --mcp slack

# 3. Verify
ccron test daily-summary
```

## Troubleshooting

- `ccron test` fails: follow the suggested fix commands in the output
- MCP auth expired: `ccron auth <name>`
- Prompt change: just edit the file if using `--prompt-file` (no re-registration needed)
- Schedule change: `ccron edit <name> --schedule "<cron>"`
