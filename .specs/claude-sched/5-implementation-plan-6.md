# 実装計画 6: help充実 + Claude Codeスキル + npm公開準備

## 概要

AIが使いこなせるhelp出力とClaude Codeスキルファイルを作成し、npm公開の準備を行う。

## 依存関係

- 前提: 5-implementation-plan-4, 5-implementation-plan-5（全コマンド実装済み）

## タスク

### コア実装

- [ ] 各コマンドの`--help`を充実させる
  - 全オプションの型・デフォルト値・必須/任意を明示
  - 具体的な使用例を複数含める
  - スケジュール記法の全パターン（add --help）
  - launchdの制約事項
- [ ] `ccron --help`: 全サブコマンドの概要一覧と使用例
- [ ] `skills/ccron.md`: Claude Codeスキルファイル作成
  - ccronの目的説明
  - AIワークフロー: 自然言語→プロンプトファイル作成→ccron add→ccron test
  - 全サブコマンドの概要
  - スケジュール記法の変換ルール
  - エラー時の対処パターン
- [ ] `package.json`のnpm公開設定最終調整: `files`, `description`, `keywords`, `repository`等

### レビュー可能性

- [ ] `ccron --help`の出力をAIに渡して、正しくコマンドを組み立てられるか確認
- [ ] スキルファイルの内容でAIがccronを操作できるか確認

### 検証

- [ ] `bunx tsc --noEmit`が通る
- [ ] `bun test`が通る
- [ ] `npm pack`でパッケージ内容を確認

## 推奨コミット

1. `feat: add comprehensive help output for all commands`
2. `feat: add Claude Code skill file for AI-driven task registration`
3. `chore: prepare package.json for npm publish`
