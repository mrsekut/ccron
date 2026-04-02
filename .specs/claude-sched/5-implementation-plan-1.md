# 実装計画 1: プロジェクト基盤 + スケジュールパーサー

## 概要

package.jsonをCLIツールとして整備し、スケジュールパーサー(Core層の純粋関数)をテスト付きで実装する。

## 依存関係

- 前提: なし（最初のPR）

## タスク

### セットアップ

- [ ] `package.json`を更新: `name: "ccron"`, `bin`フィールド追加, `private`削除, `files`設定
- [ ] `src/cli.ts`を作成: エントリポイントのスケルトン（サブコマンドルーティングの骨組み）
- [ ] CLIの引数パース方式を決定・実装（`process.argv`手パース or 軽量ライブラリ）

### コア実装

- [ ] `src/schedule.ts`: `parseSchedule(input: string): CalendarInterval[]`を実装
  - 人間可読形式: `"HH:MM daily"`, `"HH:MM weekdays"`, `"HH:MM mon,wed,fri"`, `"HH:MM fri"`
  - cron式フォールバック: `"M H * * D"`形式のパース
  - StartCalendarIntervalで表現不可能なスケジュールはエラー
- [ ] `src/schedule.test.ts`: パーサーのテスト
  - 各記法のパース成功ケース
  - エラーケース（不正な形式、表現不可能なスケジュール）

### レビュー可能性

- [ ] テストが全パターンのパース結果を検証している
- [ ] `bun run src/cli.ts --help`で基本的なヘルプが表示される

### 検証

- [ ] `bunx tsc --noEmit`が通る
- [ ] `bun test`が通る

## 推奨コミット

1. `feat: setup project as CLI tool with bin entry point`
2. `feat: implement schedule parser with human-readable and cron format support`
3. `test: add schedule parser tests`
