# 実装計画 3: launchd操作 + addコマンド(エンドツーエンド)

## 概要

launchctl操作モジュールとaddコマンドを実装し、`ccron add`で実際にタスク登録できるようにする。最初のエンドツーエンド動線。

## 依存関係

- 前提: 5-implementation-plan-2（config + generator）

## タスク

### コア実装

- [ ] `src/launchd.ts`: launchctl操作
  - `bootstrap(plistPath: string): Promise<void>`
  - `bootout(label: string): Promise<void>`
  - `kickstart(label: string): Promise<void>`
  - `listOne(label: string): Promise<{pid: number | null, status: number | null} | null>`
- [ ] `src/commands/add.ts`: addコマンドの実装
  - 引数パース(--name, --schedule, --prompt, --prompt-file, --mcp, --allowed-tools, --max-turns)
  - バリデーション(名前重複、prompt排他チェック、prompt-file存在確認)
  - claude CLIパス自動検出(`which claude`)、グローバル設定保存
  - config保存 → MCP生成 → スクリプト生成 → plist生成 → launchd登録
  - 各ステップの進捗表示
- [ ] `src/cli.ts`にaddサブコマンドのルーティングを追加

### レビュー可能性

- [ ] 実際に`bun run src/cli.ts add --name test-task --schedule "9:00 daily" --prompt "hello"`を実行して、全ファイルが生成されlaunchdに登録されることを確認
- [ ] `ccron add`後に`launchctl list | grep ccron`で登録を確認

### 検証

- [ ] `bunx tsc --noEmit`が通る
- [ ] `bun test`が通る

## 推奨コミット

1. `feat: add launchd module for launchctl operations`
2. `feat: implement add command with end-to-end task registration`
