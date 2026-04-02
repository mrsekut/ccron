# 要件: ccron

## ユーザーストーリー

macOSユーザーとして、`claude -p`の定期実行を簡単にセットアップするために、launchdの罠を吸収したCLIツールを使いたい。

## 受け入れ基準

- [ ] `ccron add`でタスク定義・スクリプト・plist・MCP設定を一括生成し、launchdに登録できる
- [ ] `ccron list`で登録済みタスクの一覧・ステータス・最終実行結果を表示できる
- [ ] `ccron run <name>`で手動実行し、ログをリアルタイム表示できる
- [ ] `ccron test <name>`で環境チェック（CLI存在、認証、ulimit、TCC、plist登録等）を実行できる
- [ ] `ccron log <name>`でログを表示でき、`--follow`でtailできる
- [ ] `ccron auth <name>`でMCPの再認証を対話的に行える
- [ ] `ccron remove <name>`でタスクに関連する全ファイルを削除し、launchdから登録解除できる
- [ ] `ccron edit <name>`で設定変更後、スクリプト・plistを再生成しlaunchdをリロードできる
- [ ] スケジュール記法として人間可読形式（`"17:15 weekdays"`等）とcron式の両方を受け付ける
- [ ] `--mcp`でプリセット名を指定するだけでMCP設定ファイルが生成される
- [ ] `bunx ccron`で即実行可能な形でnpm公開できる
- [ ] `ccron --help`および各サブコマンドの`--help`がAIが読んで使い方を理解できる十分な情報量を持つ
- [ ] Claude Code用スキルファイルを同梱し、AIがccronの登録・管理を代行できる

## スコープ

### スコープ内

- macOS launchd対応
- サブコマンド: add, list, run, test, log, auth, remove, edit
- 人間可読スケジュール記法 + cron式フォールバック
- MCPプリセット（slack, linear）
- `--prompt` / `--prompt-file` によるプロンプト指定
- claude CLIパスの自動検出とグローバル設定への保存
- AI向けのhelp出力（各コマンドの全オプション・例・制約を含む）
- Claude Code用スキルファイル同梱（AIがccronを操作するためのガイド）

### スコープ外

- Linux (systemd) / Windows (Task Scheduler) 対応
- 対話的ウィザード (`claude-sched init`)
- 実行履歴のDB記録
- 失敗時の通知（Slack/メール）
- プロンプトテンプレート変数（`{{date}}`等）
