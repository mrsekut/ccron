---
name: ccron
description: >
  Schedule claude -p execution on macOS with launchd. Use when the user wants to
  set up, change or remove recurring claude jobs, check whether they ran, or run one now.
allowed-tools: 'Read,Write,Edit,Bash(ccron:*),Bash(bunx @mrsekut/ccron:*)'
version: '1.0.0'
author: 'mrsekut'
---

# ccron - Schedule claude -p on macOS with launchd

Jobs are declared in a `ccron.json` in the user's project. `ccron apply` makes launchd match it. Never edit the generated scripts or plists directly.

## Workflow

1. Find the project's `ccron.json`. If there is none, create one (e.g. `<project>/ccron/ccron.json`).
2. Edit `ccron.json`: add, change or remove a job.
3. `ccron apply <ccron.json> --dry-run` and show the plan to the user.
4. After the user agrees, `ccron apply <ccron.json>`.
5. `ccron status <ccron.json>` to confirm every job is `in sync`.

Run `ccron <command> --help` for the latest options.

## ccron.json

```json
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
```

- `schedule`, `prompt`, `cwd` are required. `mcpConfig` is optional. Other keys are errors.
- `cwd` and `mcpConfig` are relative to the directory of `ccron.json`.
- `cwd` must be a project directory outside `~/Desktop`, `~/Documents`, `~/Downloads` (TCC).
- **Keep `prompt` a one-liner that invokes a skill in the project.** Put the instructions in the skill, not in `ccron.json`.
- MCP config files contain only server URLs. Do not put tokens in them if the project is a git repository.

## Commands

| Command                                | Purpose                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| `ccron apply <ccron.json> [--dry-run]` | Make launchd match the manifest                               |
| `ccron status <ccron.json>`            | Sync state, launchd status, last exit, log path; other jobs   |
| `ccron run <name>`                     | Run a job now and tail its log (Ctrl+C stops tailing only)    |

`ccron run` really executes the job: it reads external services and writes files. Ask the user before running it.

## Schedule (cron)

Format: `"minute hour * * day-of-week"` (5 fields)

| Goal                  | Cron              |
| --------------------- | ----------------- |
| Daily at 17:15        | `"15 17 * * *"`   |
| Weekdays at 17:15     | `"15 17 * * 1-5"` |
| Every Friday at 22:00 | `"0 22 * * 5"`    |
| Mon/Wed/Fri at 9:00   | `"0 9 * * 1,3,5"` |

Step values (`*/5`) and minute/hour ranges are not supported (launchd limitation).

## Troubleshooting

- Did it run? `ccron status <ccron.json>` shows the last exit and the log path; read the end of the log. A job that never ran also shows `last exit 0`.
- `apply` reports a conflict: another manifest owns that job name. Rename the job or remove it from the other manifest.
- `status` lists an unowned or orphaned job: it is not managed by this manifest. Ask the user before running the printed remove command.
- MCP auth expired: the user runs `claude --mcp-config <path>` interactively and signs in again.
