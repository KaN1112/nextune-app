# NexTune 1.2.0 — Gaming PC Utility

日本語のWindows向けPCユーティリティ。ブランドの説明のみ英語、ネットワーク測定の表記は「パケットロス」です。

## 1クリック整理

ダッシュボードの「一時ファイルを整理」を押すと、ユーザーの一時フォルダー直下から24時間以上前の通常ファイルをスキャンし、自動削除します。1回最大5000候補、60秒間隔です。ファイルごとにパス・更新日時・サイズ・使用中かどうかを再確認し、アクセスできないファイルやリンクは残します。アプリ終了・ワーキングセット整理は行いません。ディスク容量の整理であり、RAM解放ではありません。削除は復元できません。

クリーナー画面ではWindows Temp、シェーダーキャッシュ、クラッシュログを個別に確認できます。配信の最適化キャッシュは「Windowsのストレージ設定を開く」からWindows側で整理します。

## 使用できる機能

- CPU/RAM・ディスク転送量・ネットワーク転送量の監視。
- GPU使用率：Windows WDDMのGPUエンジンカウンターから、プロセス分をエンジンごとに合算した最大使用率を表示。
- VRAM：全GPUの専用メモリ使用量合計。統合GPUの共有RAMを含みません。
- GPU/VRAMは約5秒ごと、CPU/RAMは約1秒ごと。最小化中の画面監視は休止します。
- アプリ管理：現在のWindowsセッションで表示ウィンドウを持つアプリを、ウィンドウ名でも検索できます。通常終了は対象プロセスの全トップレベルウィンドウへ送信し、3秒以内に終了したか確認します。残った場合だけ、再確認後の強制終了を選べます。強制終了では未保存データが失われる可能性があります。NexTuneと主要なWindowsプロセスは対象外です。
- ゲームブースト：対応する既存の高パフォーマンス電源プランを選択・適用・復元。非対応PCはWindowsの電源設定を開けます。
- ゲームモード：状態確認とWindowsの専用設定画面への移動。
- 設定：Windowsへのサインイン時の自動起動、最小化起動、トレイへの収納。すべて初期状態ではオフです。トレイメニューから開く／終了できます。
- 運営からのお知らせ：リポジトリ直下の `announcements.json` を取得します。GitHubへログインできる管理者がWeb編集画面から内容を更新でき、アプリの再ビルドは不要です。
- お知らせには任意のHTTPSリンクとボタン名を添付できます。ダウンロード先や詳細ページは投稿ごとに指定します。

## 自動アップデートについて

Tauriの署名検証付きアップデーターを導入できます。SignPathのWindowsコード署名とは別に、Tauriアップデート専用の公開鍵・秘密鍵が必要です。秘密鍵はGitHub ActionsのSecretだけに保存し、リポジトリへ置いてはいけません。

アップデーターを含まない既存版へ後から自動更新機能を追加することはできません。既存ユーザーは最初の「アップデーター対応版」だけ手動でインストールし、それ以降はアプリ内更新に移行できます。鍵を紛失すると既存インストールへ新しい更新を配信できなくなるため、バックアップが必要です。

設定方法は `UPDATER_SETUP.md` を参照してください。

## 保存と権限

設定・復元履歴・固定イベント名のログは `%APPDATA%/app.nextune.utility` に保存します。自動起動を有効にしたときだけHKCUのRunキーにNexTuneを登録します。exeを移動した場合は自動起動設定をオフ→オンにして登録し直してください。アンインストール前には自動起動をオフにしてください。

通常は管理者権限不要。Windows管理の領域は権限により削除できない場合があります。ゲームやOSの設定を無差別に変更しません。データ送信は手動Pingとお知らせ取得のみです。お知らせに添付されたリンクは外部ブラウザーを使用します。

## ビルド

Windows x64、WebView2、Node.js、Rust 1.98以降、Visual Studio C++ Build Toolsが必要です。

```powershell
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run build
```

`src-tauri/target/release/nextune.exe` と `src-tauri/target/release/bundle/nsis/` に出力します。

GitHub Actions用の手動ビルド設定も同梱しています。ソースをリポジトリのルートへ置き、Actionsの「Windows build」を実行すると未署名の成果物を生成する構成です。この作業ではGitHubへのアップロードやActions実行はしていません。

UI確認は `npm run preview` を起動後、別ターミナルで `npm run test:ui`。ブラウザープレビューはOS操作不可です。画面操作テストはIPC fixtureを使います。

## 検証状況

1.2.0の検証範囲は VALIDATION.md を参照してください。旧バージョンのexeに今回の変更は含まれません。

一次資料：[Tauri tray](https://v2.tauri.app/learn/system-tray/)、[Windows Runキー](https://learn.microsoft.com/en-us/windows/win32/setupapi/run-and-runonce-registry-keys)、[Windows GPU監視](https://devblogs.microsoft.com/directx/gpus-in-the-task-manager/)。依存ライセンスは THIRD_PARTY_NOTICES.md に同梱。

Created by KaN.  
inspired by VyLite.
