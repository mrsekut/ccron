---
name: ccron
description: >
  Schedule claude -p execution on macOS with launchd. Use when the user wants to
  set up recurring claude tasks, manage scheduled prompts, or automate claude CLI runs.
allowed-tools: "Read,Write,Bash(ccron:*)"
version: "0.1.0"
author: "mrsekut"
---

# ccron - claude -p の定期実行をmacOSで管理するCLIツール

macOSのlaunchdを使って`claude -p`をスケジュール実行する。
launchd特有の罠（環境変数、TCC保護、ulimit、keychain等）を全て吸収する。

## ワークフロー

ユーザーが「〇〇を定期実行して」と言ったら:

1. プロンプトファイルを作成する（`./prompts/<name>.txt`等、gitで管理できる場所）
2. `ccron add`で登録する
3. `ccron test <name>`で環境を確認する

**詳細は `ccron --help` および `ccron <command> --help` を実行して最新情報を確認すること。**

## コマンド一覧

| コマンド | 用途 |
|---|---|
| `ccron add` | タスク登録 |
| `ccron list` | タスク一覧 + launchdステータス |
| `ccron run <name>` | 手動実行（ログをtail） |
| `ccron test <name>` | 環境チェック |
| `ccron log <name>` | ログ表示 (`--follow`でtail) |
| `ccron auth <name>` | MCP再認証 |
| `ccron edit <name>` | タスク設定変更（再生成+リロード） |
| `ccron remove <name>` | タスク削除 (`--purge`でログも削除) |

## ccron add のオプション

```
--name <name>           タスク名（英小文字・数字・ハイフン）
--schedule "<cron>"     cron式: "minute hour * * day-of-week"
--prompt "<text>"       プロンプト文字列（--prompt-fileと排他）
--prompt-file <path>    プロンプトファイルパス（--promptと排他）
--mcp <names>           MCPプリセット（slack,linear）
--allowed-tools <tools> 許可ツール（Bash,Read,Write等）
--max-turns <n>         最大ターン数
```

## スケジュール（cron式）

`"minute hour * * day-of-week"` の5フィールド。

| やりたいこと | cron式 |
|---|---|
| 毎日17:15 | `"15 17 * * *"` |
| 平日17:15 | `"15 17 * * 1-5"` |
| 毎週金曜22:00 | `"0 22 * * 5"` |
| 月水金 9:00 | `"0 9 * * 1,3,5"` |

**制約**: `*/5`等のステップ値、minute/hourの範囲指定は不可（launchdの仕様）。

## 典型的な例

ユーザー: 「平日17時にSlackで日次まとめを投稿して」

```bash
# 1. プロンプトファイルを作成
cat > ./prompts/daily-summary.txt << 'EOF'
今日の日付の日次まとめを作成し、#daily-summary チャンネルに投稿してください。
EOF

# 2. 登録
ccron add \
  --name daily-summary \
  --schedule "0 17 * * 1-5" \
  --prompt-file ./prompts/daily-summary.txt \
  --mcp slack

# 3. 環境確認
ccron test daily-summary
```

## エラー対処

- `ccron test`が失敗 → 表示される修正コマンドに従う
- MCP認証切れ → `ccron auth <name>`
- プロンプト変更 → `--prompt-file`ならファイル編集するだけ（再登録不要）
- スケジュール変更 → `ccron edit <name> --schedule "<cron>"`
