# 自動アップデート導入手順

NexTuneはGitHub ReleasesとTauri v2 Updaterを使って自動更新できます。WindowsのSignPathコード署名だけではTauri Updaterの署名要件を満たしません。

## 初回だけ必要な準備

1. 管理者ではない通常のPowerShellで、リポジトリのルートから次を実行します。

```powershell
npm ci
npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\nextune-updater.key"
```

2. 表示された公開鍵を安全に控えます。秘密鍵ファイルとそのパスワードは公開しないでください。
3. GitHubリポジトリの Settings → Secrets and variables → Actions に次を追加します。

- `TAURI_SIGNING_PRIVATE_KEY`：`nextune-updater.key`の内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：生成時に設定したパスワード

4. 公開鍵を開発ソースの `tauri.conf.json` の `plugins.updater.pubkey` に設定します。
5. エンドポイントを次に設定します。

```text
https://github.com/KaN1112/nextune-app/releases/latest/download/latest.json
```

秘密鍵やパスワードをコミットしないでください。秘密鍵はオフラインにもバックアップします。

## リリース時

バージョンを上げて `v1.2.0` のようなタグを作成します。GitHub ActionsでNSISインストーラー、Tauri署名ファイル、`latest.json`を同じGitHub Releaseへ添付します。アプリは`latest.json`のバージョン・URL・署名を確認し、署名検証に成功した更新だけをインストールします。

最初のアップデーター対応版は、既存ユーザーが手動でインストールする必要があります。以降の版からアプリ内更新を利用できます。

公式資料：https://v2.tauri.app/plugin/updater/
