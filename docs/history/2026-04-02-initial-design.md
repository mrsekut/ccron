# 2026-04-02 初期設計（0.1.0）

> git の履歴（`bb0cec8` で追加し `1125241` で削除した `.specs/claude-sched/`）から再構成。

## 目的

`claude -p` を macOS で定期実行したい。launchd の罠を吸収して、1 コマンドで登録できるようにする。

吸収したかった罠:

- launchd はシェルのプロファイルを読まないので、PATH・HOME を明示しないと `claude` が見つからない。
- launchd は cron 式ではなく `StartCalendarInterval`。「5 分ごと」のような間隔は表現できない。
- TCC 保護ディレクトリ（`~/Desktop`・`~/Documents` など）は launchd から触れない。

## 形

- 命令型のサブコマンド: `add` / `list` / `run` / `test` / `log` / `auth` / `remove` / `edit`（直後に `show` も追加）。
- タスク定義は `~/.config/ccron/tasks/<name>.json` に保存し、そこからスクリプト（`~/.local/bin/ccron-<name>.sh`）と plist を生成する。
- MCP は `--mcp slack,linear` のようなプリセット名で指定し、設定ファイルを生成する。
- スケジュールは人間可読形式（`"17:15 weekdays"`）と cron 式の両方。
- `--help` とスキルファイル（`skills/ccron/SKILL.md`）を厚くし、AI が ccron を操作する前提。

## 同日に変えたこと

- 人間可読のスケジュール形式を削除し、cron 式だけにした（`a0555af`）。AI がスキル経由でコマンドを組み立てるので、人間向けの記法は不要だった。
