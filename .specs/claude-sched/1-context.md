# コンテキスト: ccron

## 技術スタック

- Language: TypeScript (Bun runtime)
- Module: ESModule (`"type": "module"`)
- Build/Run: Bun (直接実行、bundler不要)
- TypeScript: strict mode, ESNext target, bundler moduleResolution

## 関連する既存コード

- `index.ts`: Hello Worldのみ。新規プロジェクト
- `package.json`: `ccron`という名前で`private: true`。npm公開用に`private`を外す必要がある

## プロジェクト規約

- CLAUDE.mdに従い、Bunファーストで開発
- `Bun.file`/`Bun.$` 等のBun APIを優先
- 外部ライブラリは最小限（CLIパーサー程度）

## 制約事項

- macOS専用（launchd前提）。Linux/Windows対応は将来の拡張
- CLIツールとしてnpm公開（`bunx ccron`で実行可能にする）
- `claude` CLIがインストール済みであることが前提
- launchdはcronと異なりStartCalendarInterval形式。「5分ごと」のような細かいインターバルは表現不可
- TCC保護ディレクトリ（`~/Desktop`, `~/Documents`等）からのスクリプト実行はmacOSに制限される
- launchd環境ではユーザーのシェルプロファイルが読み込まれないため、PATH/HOME等の環境変数を明示的に設定する必要がある
