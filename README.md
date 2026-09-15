# NexTune 1.1.0 — Gaming PC Utility

日本語のWindows向けPCユーティリティ。ブランドの説明のみ英語、ネットワーク測定の表記は「パケットロス」です。

## 1クリック整理

ダッシュボードの「一時ファイルを整理」を押すと、ユーザーの一時フォルダー直下から24時間以上前の通常ファイルをスキャンし、自動削除します。1回最大5000候補、60秒間隔です。ファイルごとにパス・更新日時・サイズ・使用中かどうかを再確認し、アクセスできないファイルやリンクは残します。アプリ終了・ワーキングセット整理は行いません。ディスク容量の整理であり、RAM解放ではありません。削除は復元できません。

クリーナー画面ではWindows Temp、シェーダーキャッシュ、クラッシュログを個別に確認できます。配信の最適化キャッシュは「Windowsのストレージ設定を開く」からWindows側で整理します。

## 使用できる機能

- CPU/RAM・ディスク転送量・ネットワーク転送量の監視。
- GPU使用率：Windows WDDMのGPUエンジンカウンターから、プロセス分をエンジンごとに合算した最大使用率を表示。
- VRAM：全GPUの専用メモリ使用量合計。統合GPUの共有RAMを含みません。
- GPU/VRAMは約5秒ごと、CPU/RAMは約1秒ごと。最小化中の画面監視は休止します。
- アプリ管理：検索、プロセス単体のメモリ使用量順、確認後の通常終了。保存確認やトレイ常駐により終了要求後も残る場合があります。
- ゲームブースト：対応する既存の高パフォーマンス電源プランを選択・適用・復元。非対応PCはWindowsの電源設定を開けます。
- ゲームモード：状態確認とWindowsの専用設定画面への移動。
- 設定：Windowsへのサインイン時の自動起動、最小化起動、トレイへの収納。すべて初期状態ではオフです。トレイメニューから開く／終了できます。
- 更新確認：手動で `KaN1112/nextune-app` のGitHub Releases最新正式版を確認。`v1.1.0`の形式のタグを使用します。未公開・非公開・接続失敗を「最新」とは扱いません。配布ページからのダウンロード方式で、自動インストールはしません。

## 保存と権限

設定・復元履歴・固定イベント名のログは `%APPDATA%/app.nextune.utility` に保存します。自動起動を有効にしたときだけHKCUのRunキーにNexTuneを登録します。exeを移動した場合は自動起動設定をオフ→オンにして登録し直してください。アンインストール前には自動起動をオフにしてください。

通常は管理者権限不要。Windows管理の領域は権限により削除できない場合があります。ゲームやOSの設定を無差別に変更しません。データ送信は手動Pingと手動のGitHub更新確認のみです。センサーツールや配布ページを開く操作は外部ブラウザーを使用します。

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

1.1.0のビルドは開発PCのアプリケーション制御に阻止されています。現在の検証範囲は VALIDATION.md を参照してください。旧1.0.0のexeに今回の変更は含まれません。

一次資料：[Tauri tray](https://v2.tauri.app/learn/system-tray/)、[Windows Runキー](https://learn.microsoft.com/en-us/windows/win32/setupapi/run-and-runonce-registry-keys)、[Windows GPU監視](https://devblogs.microsoft.com/directx/gpus-in-the-task-manager/)、[GitHub Releases API](https://docs.github.com/en/rest/releases/releases)。依存ライセンスは THIRD_PARTY_NOTICES.md に同梱。

Created by KaN.  
inspired by VyLite.
