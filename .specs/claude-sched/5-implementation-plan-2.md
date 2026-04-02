# 実装計画 2: config + generator(Core層)

## 概要

タスク設定・グローバル設定の型定義とI/O、およびシェルスクリプト・plist・MCP設定の生成ロジック(純粋関数)を実装する。

## 依存関係

- 前提: 5-implementation-plan-1（スケジュールパーサー）

## タスク

### コア実装

- [ ] `src/config.ts`: パス定数定義(`~/.config/ccron/tasks/`等)、TaskConfig/GlobalConfigの読み書き
- [ ] `src/mcp.ts`: MCPプリセット定義、`buildMcpConfig(presets: string[]): object`
- [ ] `src/generator.ts`: 以下の純粋関数を実装
  - `generateScriptContent(task: TaskConfig, global: GlobalConfig): string`
  - `generatePlistContent(task: TaskConfig, global: GlobalConfig, intervals: CalendarInterval[]): string`
  - `generateMcpConfigContent(presets: string[]): string`
- [ ] `src/generator.test.ts`: 生成内容のスナップショットテスト
  - スクリプト: HOME/PATH/ulimit/cd /tmp が含まれること
  - plist: StartCalendarIntervalが正しいこと
  - MCP: プリセットが正しく展開されること
  - `--prompt` vs `--prompt-file`で生成内容が変わること

### レビュー可能性

- [ ] テストが生成物の構造を検証している
- [ ] 生成されるスクリプト・plistを目視で確認可能

### 検証

- [ ] `bunx tsc --noEmit`が通る
- [ ] `bun test`が通る

## 推奨コミット

1. `feat: add config module with task/global config types and I/O`
2. `feat: add MCP presets and config builder`
3. `feat: add script, plist, and MCP config generators`
4. `test: add generator snapshot tests`
