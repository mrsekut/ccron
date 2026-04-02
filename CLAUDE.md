---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: '*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json'
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use `Bun.$` for shell commands instead of execa
- Use `util.parseArgs` for CLI argument parsing

## Testing

Use `bun test` to run tests.

```ts
import { test, expect } from 'bun:test';
```

## Project Structure

```
src/
  cli.ts           Entry point (bin)
  commands/        Subcommand implementations (add, list, run, test, log, auth, edit, remove)
  config.ts        Task/global config types, file I/O, validation
  schedule.ts      Cron expression parser -> CalendarInterval
  generator.ts     Shell script, plist, MCP config generators (pure functions)
  launchd.ts       launchctl operations (bootstrap, bootout, kickstart, list)
  mcp.ts           MCP preset definitions and config builder
skills/ccron/
  SKILL.md         Claude Code skill for AI-driven task management
```

## Architecture

Three-layer design: Core (pure functions) -> I/O (file/process) -> CLI (user interface).

Keep schedule parsing, script/plist generation, and validation as pure functions in the Core layer.
File I/O and launchctl operations belong in the I/O layer.
Commands are the CLI layer, handling user input/output only.
