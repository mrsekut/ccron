# ccron

Schedule `claude -p` execution on macOS with launchd.

Declare jobs in a `ccron.json` inside your project, and `ccron apply` makes launchd match it. The project repository is the single place that tells you what runs and when.

## Usage

Run directly with `bunx`:

```bash
bunx @mrsekut/ccron <command> [options]
```

## Claude Code Skill

Install the ccron skill so Claude Code can edit `ccron.json` and apply it for you:

```bash
bunx skills add mrsekut/ccron
```

## Quick Start

Put a `ccron.json` in your project, for example at `myproject/ccron/ccron.json`:

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

```bash
ccron apply ccron/ccron.json --dry-run   # show the plan
ccron apply ccron/ccron.json             # make launchd match it
ccron status ccron/ccron.json            # sync state, last exit, log path
ccron run member-watch                   # run once now and tail the log
```

## Commands

| Command                                | Description                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `ccron apply <ccron.json> [--dry-run]` | Create, update, adopt and delete jobs so launchd matches the manifest       |
| `ccron status <ccron.json>`            | Show each job's sync state, launchd status and log, and other ccron jobs    |
| `ccron run <name>`                     | Trigger a job now and tail its log                                          |

`apply` validates the whole manifest first and changes nothing if any job is invalid. It is idempotent: if it stops halfway, fix the cause and run it again.

## ccron.json

| Key         | Required | Description                                                              |
| ----------- | -------- | ------------------------------------------------------------------------ |
| `schedule`  | yes      | Cron expression (see below)                                              |
| `prompt`    | yes      | Prompt passed to `claude -p`                                             |
| `cwd`       | yes      | Directory claude runs in                                                 |
| `mcpConfig` | no       | MCP config JSON passed to `--mcp-config`                                 |

- `cwd` and `mcpConfig` are resolved against the directory of `ccron.json`.
- Unknown keys are errors, so a typo cannot be silently ignored.
- `cwd` must not be under `~/Desktop`, `~/Documents` or `~/Downloads`. macOS TCC blocks claude started from launchd from reading them.

### Keep the prompt a one-liner

`claude` picks up its project context from `cwd`, so the job can use that project's `CLAUDE.md`, `.claude/skills/` and `.mcp.json`. Put the actual instructions in a skill and keep `prompt` a one-liner that invokes it. The instructions stay under version control, and manual runs and scheduled runs share one definition.

## Schedule Format

Standard cron expression: `"minute hour * * day-of-week"`

```
15 17 * * *     Every day at 17:15
15 17 * * 1-5   Weekdays at 17:15
0 22 * * 5      Every Friday at 22:00
0 9 * * 1,3,5   Mon/Wed/Fri at 9:00
```

Step values (`*/5`) and minute/hour ranges are not supported (launchd limitation).

## Ownership

Each generated plist records the manifest that owns it (`CCRON_MANIFEST`, the manifest's real path). Several manifests can coexist on one machine.

- `apply` deletes only jobs its own manifest created and no longer declares.
- A job name already owned by another manifest is a conflict, and `apply` changes nothing.
- A `com.ccron.*` job with no owner (made by hand, or by ccron 0.x) is adopted when a manifest declares the same name. Otherwise it is left alone, and `status` prints a command to remove it.

## Generated Files

```
~/.local/bin/ccron-<name>.sh                    script launchd runs
~/Library/LaunchAgents/com.ccron.<name>.plist   launchd job
~/.local/share/ccron/logs/<name>.log            stdout and stderr (kept when the job is deleted)
```

## MCP Authentication

If an MCP server's OAuth token expires, start claude interactively with the same config and sign in again:

```bash
claude --mcp-config path/to/mcp.json
```

## Migrating from 0.x

1. Write a `ccron.json` that declares the existing tasks under the same names.
2. `ccron apply ccron.json --dry-run` should show them as `adopt`.
3. `ccron apply ccron.json`.
4. Remove `~/.config/ccron/`. 1.0 no longer reads it.
