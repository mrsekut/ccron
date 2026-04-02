# 実装計画 5: remove, edit, authコマンド

## 概要

タスクの変更・削除・MCP再認証コマンドを実装する。

## 依存関係

- 前提: 5-implementation-plan-3（addコマンド）
- 並行: 5-implementation-plan-4と並行可能

## タスク

### コア実装

- [ ] `src/commands/remove.ts`: タスク削除
  - `launchctl bootout`で登録解除
  - plist、スクリプト、タスク設定を削除
  - MCP設定は他タスクが参照していなければ削除
  - ログは残す（`--purge`で削除）
- [ ] `src/commands/edit.ts`: タスク設定変更
  - 変更可能: --schedule, --prompt, --prompt-file, --mcp, --allowed-tools, --max-turns
  - タスク設定JSON更新 → スクリプト・plist再生成 → launchdリロード(bootout + bootstrap)
- [ ] `src/commands/auth.ts`: MCP再認証
  - `cd /tmp && claude --mcp-config <path>`を対話的に起動
- [ ] `src/cli.ts`に3コマンドのルーティングを追加

### レビュー可能性

- [ ] add → edit → listで設定変更が反映されている
- [ ] add → remove → listでタスクが消えている
- [ ] removeでログファイルが残り、`--purge`で消える

### 検証

- [ ] `bunx tsc --noEmit`が通る
- [ ] `bun test`が通る

## 推奨コミット

1. `feat: implement remove command with cleanup`
2. `feat: implement edit command with plist reload`
3. `feat: implement auth command for MCP re-authentication`
