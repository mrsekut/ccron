# 設計: ccron

## ドメインモデル

```typescript
type TaskConfig = {
  name: string; // 英数字とハイフン
  schedule: string; // cron式 (e.g. "15 17 * * 1-5")
  prompt: string | null;
  promptFile: string | null;
  mcp: string[]; // プリセット名
  allowedTools: string[];
  maxTurns: number | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
};

type GlobalConfig = {
  claudePath: string; // claude CLIが存在するディレクトリ
  extraPaths: string[];
  ulimit: number;
};

/** StartCalendarIntervalに変換されたスケジュール */
type CalendarInterval = {
  Hour: number;
  Minute: number;
  Weekday?: number; // 0=Sun, 1=Mon, ..., 6=Sat
};

type McpServerConfig = {
  type: string;
  url: string;
};
```

## 機能の境界

| 機能      | 責務                                                                  | 依存先                               |
| --------- | --------------------------------------------------------------------- | ------------------------------------ |
| cli       | CLIエントリポイント、引数パース、サブコマンドルーティング             | commands/\*                          |
| commands  | 各サブコマンドの実装（add, list, run, test, log, auth, remove, edit） | config, schedule, generator, launchd |
| config    | TaskConfig/GlobalConfigの読み書き、バリデーション                     | -                                    |
| schedule  | cron式のパース → CalendarInterval変換                                 | -                                    |
| generator | シェルスクリプト・plist・MCP設定ファイルの生成                        | config, schedule                     |
| launchd   | launchctl操作（bootstrap, bootout, kickstart, list）                  | -                                    |
| mcp       | MCPプリセット管理、plugin設定からのclientId検出                       | -                                    |

## ディレクトリ構成

```
src/
├── cli.ts              ← エントリポイント（bin）
├── commands/
│   ├── add.ts
│   ├── list.ts
│   ├── run.ts
│   ├── test.ts
│   ├── log.ts
│   ├── auth.ts
│   ├── remove.ts
│   └── edit.ts
├── config.ts           ← TaskConfig/GlobalConfigの読み書き
├── schedule.ts         ← スケジュールパーサー
├── generator.ts        ← スクリプト/plist/MCP設定の生成
├── launchd.ts          ← launchctl操作
└── mcp.ts              ← MCPプリセット・設定管理
claude-plugin/
└── skills/ccron/
    └── SKILL.md        ← Claude Code用スキルファイル（npmに同梱）
```

## AI連携

### help設計

`ccron --help`および各サブコマンドの`--help`は、AIが読んで正しくコマンドを組み立てられるよう設計する:

- 全オプションの型・デフォルト値・制約を明示
- 具体的な使用例を複数含める
- スケジュール記法の全パターンを記載
- launchdの制約（表現できないスケジュール）を明記

### スキルファイル（`claude-plugin/skills/ccron/SKILL.md`）

npmパッケージに同梱し、インストール後に`~/.claude/skills/`へシンボリックリンクまたはコピーして使う。beadsのclaude-plugin構造に準拠。

典型的なAIワークフロー:

1. ユーザーが自然言語でやりたいことを伝える（「平日17時にSlackで日次まとめ投稿して」）
2. AIがプロンプトファイルを作成（例: `./prompts/daily-summary.txt`）
3. AIが`ccron add --name daily-summary --schedule "17:00 weekdays" --prompt-file ./prompts/daily-summary.txt --mcp slack`を実行
4. AIが`ccron test daily-summary`で環境確認

スキルの内容:

- ccronの目的と全サブコマンドの概要
- 上記ワークフロー（プロンプト作成→add→test）の手順
- `ccron add --help`を実行して最新オプションを確認する指示
- スケジュール記法の変換ルール
- エラー時の対処パターン

## メインフロー（addコマンド）

1. `parseArgs`: argv → AddOptions（名前、スケジュール、プロンプト等）
2. `validateAddOptions`: AddOptions → ValidatedAddOptions（重複チェック、ファイル存在確認等）
3. `detectClaudePath`: void → string（初回のみ、claude CLIのパスを自動検出）
4. `saveTaskConfig`: ValidatedAddOptions → TaskConfig（JSONファイル保存）
5. `generateMcpConfig`: TaskConfig → McpConfigFile（MCP設定ファイル生成、--mcp指定時のみ）
6. `generateScript`: TaskConfig + GlobalConfig → ShellScript（実行スクリプト生成）
7. `generatePlist`: TaskConfig + GlobalConfig + CalendarInterval[] → PlistFile（plist生成）
8. `registerLaunchd`: PlistFile → void（launchctl bootstrap実行）

## レイヤー構成

```
Core (pure functions) → I/O (file/process) → CLI (user interface)
```

| ロジック                            | レイヤー | 理由                                   |
| ----------------------------------- | -------- | -------------------------------------- |
| parseSchedule                       | Core     | 純粋関数。文字列→CalendarInterval変換  |
| validateTaskName                    | Core     | 純粋関数。正規表現マッチ               |
| validateAddOptions                  | Core     | 純粋関数。オプション間の整合性チェック |
| generateScriptContent               | Core     | 純粋関数。設定→文字列変換              |
| generatePlistContent                | Core     | 純粋関数。設定→XML文字列変換           |
| buildMcpConfig                      | Core     | 純粋関数。プリセット名→JSON変換        |
| readTaskConfig / saveTaskConfig     | I/O      | ファイルシステムアクセス               |
| detectClaudePath                    | I/O      | `which`コマンド実行                    |
| registerLaunchd / unregisterLaunchd | I/O      | launchctlプロセス実行                  |
| commands/add, list, ...             | CLI      | ユーザー入力の受付、出力フォーマット   |
