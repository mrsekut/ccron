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
  cli.ts           Entry point (bin): apply / status / run
  commands/        apply.ts, status.ts, run.ts (CLI layer)
  domain.ts        Domain types and smart constructors (JobName, Manifest, Plan, ...)
  manifest.ts      ccron.json -> validated Manifest (pure)
  schedule.ts      Cron expression parser -> CalendarInterval (pure)
  plan.ts          plan(manifest, actual) -> actions or conflicts (pure)
  generator.ts     Shell script and plist rendering (pure)
  format.ts        Text output for plans, owners, conflicts (pure)
  workflow.ts      prepare(): read -> parse -> read state -> plan, shared by apply and status
  state.ts         Read installed jobs and their owner from LaunchAgents (I/O)
  execute.ts       Apply a Plan to disk and launchd (I/O)
  launchd.ts       launchctl operations (I/O)
  paths.ts         Generated file locations, injected for tests
  testing/         Fake launchd for tests
skills/ccron/
  SKILL.md         Claude Code skill: edit ccron.json and apply it
docs/history/      Design decisions, newest first by date
```

## Architecture

Read (I/O) -> parse -> plan -> render (pure) -> execute (I/O).

Keep parsing, planning and rendering pure. Anything that touches the machine
(home, generated paths, launchctl, the claude location) is passed in through
`Deps` so commands can run against a temporary directory and a fake launchd.

The manifest is the single source of truth. Do not add persisted state under
`~/.config`; read the actual state from the generated files and launchctl.
