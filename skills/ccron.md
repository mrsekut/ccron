# ccron - claude -p の定期実行をmacOSで管理するCLIツール

macOSのlaunchdを使って`claude -p`をスケジュール実行する。
launchd特有の罠（環境変数、TCC保護、ulimit、keychain等）を全て吸収する。

## ワークフロー

ユーザーが「〇〇を定期実行して」と言ったら:

1. プロンプトファイルを作成する（`./prompts/<name>.txt`等、gitで管理できる場所）
2. `ccron add`で登録する
3. `ccron test <name>`で環境を確認する

## コマンド一覧

```
ccron add       タスク登録
ccron list      タスク一覧
ccron run       手動実行（ログをtail）
ccron test      環境チェック
ccron log       ログ表示
ccron auth      MCP再認証
ccron remove    タスク削除
ccron edit      タスク設定変更
```

## ccron add の使い方

```bash
ccron add \
  --name <name> \
  --schedule "<cron>" \
  --prompt-file <path> \       # または --prompt "<text>"
  --mcp slack,linear \         # オプション: MCPプリセット
  --allowed-tools "Bash,Read" \ # オプション
  --max-turns 20                # オプション
```

### スケジュール（cron式）

`"minute hour * * day-of-week"` の5フィールド。launchdの制約あり。

| やりたいこと | cron式 |
|---|---|
| 毎日17:15 | `"15 17 * * *"` |
| 平日17:15 | `"15 17 * * 1-5"` |
| 毎週金曜22:00 | `"0 22 * * 5"` |
| 月水金 9:00 | `"0 9 * * 1,3,5"` |

**制約**: `*/5`等のステップ値、minute/hourの範囲指定は不可（launchdの仕様）。

### タスク名

英小文字・数字・ハイフンのみ。例: `daily-summary`, `weekly-review`

### MCPプリセット

`slack`, `linear` が利用可能。カンマ区切りで指定。

## 管理コマンド

```bash
# 一覧
ccron list

# 設定変更（スクリプト・plist再生成＋launchdリロード）
ccron edit <name> --schedule "0 18 * * 1-5"
ccron edit <name> --prompt-file ./prompts/v2.txt

# 手動実行（ログをリアルタイム表示）
ccron run <name>

# ログ確認
ccron log <name>
ccron log <name> --follow

# 環境チェック（claude CLI、認証、ulimit、TCC、plist等）
ccron test <name>

# MCP再認証
ccron auth <name>

# 削除（ログは残る。--purgeでログも削除）
ccron remove <name>
ccron remove <name> --purge
```

## 典型的な例

ユーザー: 「平日17時にSlackで日次まとめを投稿して」

```bash
# 1. プロンプトファイルを作成
cat > ./prompts/daily-summary.txt << 'EOF'
今日の日付の日次まとめを作成し、#daily-summary チャンネルに投稿してください。
以下を含めてください:
- 今日完了したタスク
- 明日の予定
- ブロッカー
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

- `ccron test`が失敗したら、表示される修正コマンドに従う
- MCP認証切れ → `ccron auth <name>`
- プロンプト変更 → `--prompt-file`ならファイルを編集するだけ（再登録不要）
- スケジュール変更 → `ccron edit <name> --schedule "<cron>"`

## 注意

- 各コマンドの詳細は `ccron <command> --help` を実行して確認すること
- macOS専用（launchdを使用）
