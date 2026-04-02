# 実装計画 4: list, run, log, testコマンド

## 概要

タスクの確認・実行・デバッグに必要な4つのサブコマンドを実装する。

## 依存関係

- 前提: 5-implementation-plan-3（addコマンド）
- 並行: 5-implementation-plan-5と並行可能

## タスク

### コア実装

- [ ] `src/commands/list.ts`: タスク一覧表示
  - `~/.config/ccron/tasks/`のJSON一覧と`launchctl list`を突合
  - テーブル形式でNAME, SCHEDULE, STATUS, LAST RUNを表示
- [ ] `src/commands/run.ts`: 手動実行
  - `launchctl kickstart`でタスクを起動
  - ログファイルを`tail -f`で追従表示
- [ ] `src/commands/log.ts`: ログ表示
  - デフォルト: ログファイルの末尾を表示
  - `--follow`: tail -fで追従
- [ ] `src/commands/test.ts`: 環境チェック
  - claude CLI存在確認
  - 認証状態チェック(`claude auth status`)
  - ulimit確認
  - スクリプト存在・TCC外パス確認
  - plist登録確認
  - MCP設定存在確認
  - 各チェック結果を✓/✗で表示、失敗時は修正コマンドを提示
- [ ] `src/cli.ts`に4コマンドのルーティングを追加

### レビュー可能性

- [ ] addで登録したタスクがlistで表示される
- [ ] runで手動実行してlogで結果を確認できる
- [ ] testで環境チェック結果が表示される

### 検証

- [ ] `bunx tsc --noEmit`が通る
- [ ] `bun test`が通る

## 推奨コミット

1. `feat: implement list command with launchd status`
2. `feat: implement run command with log tailing`
3. `feat: implement log command`
4. `feat: implement test command with environment checks`
