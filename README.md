# NexTune 1.0.0 日本語版

**ゲーミングPCユーティリティ — 整える。確認する。ゲームを楽しむ。**

画面、確認ダイアログ、操作結果、エラーメッセージ、NSISインストーラーを日本語化しました。内部の設定キーや履歴形式は英語版と共通で、既存データをそのまま読み込めます。

Windows向けのTauri v2 / Rust / HTML / CSS / Vanilla JavaScriptアプリです。ReactなどのUIフレームワークや、ランタイム用のチャートライブラリは使用していません。

## 起動

配布用の `NexTune.exe` を実行してください。通常は標準ユーザー権限で使用します。Microsoft Edge WebView2 Runtimeが必要です。設定と履歴はTauriのアプリデータフォルダ（通常 `%APPDATA%\app.nextune.utility`）に保存します。

初回のWelcome画面のあとにダッシュボードへ進みます。初回スキャンは読み取りのみです。ネットワークへのPingはネットワーク画面から明示的に開始します。

## 実装済み機能

| 画面 | 動作 |
| --- | --- |
| ダッシュボード | CPU/GPU名、RAM容量、Windows、アーキテクチャ、CPU/RAMライブ表示、ネットワーク情報、スコア内訳 |
| ゲームブースト | 変更しないスキャン、電源プラン確認、ゲームモード明示設定の読み取り、アプリ候補、個別選択、確認モーダル、結果 |
| パフォーマンス | CPU/RAM、ディスク転送量、ネットワーク送受信量、最大60サンプルのCanvasグラフ |
| ネットワーク | Cloudflare / Google / 任意のIPv4・IPv6、20回Ping、平均・最小・最大・ジッター・損失率、アダプター・IPv4・DNS |
| クリーナー | カテゴリ別スキャン、選択したカテゴリだけの安全な削除、Deleted / Skipped / Failed |
| 復元 | 電源プランの変更前・変更後GUID、JSON履歴、復元前確認、外部変更の競合検出 |
| 設定 | ダーク / ライト / System、Boost設定、プロセス除外の追加・削除、JSON保存 |

### ゲームブースト

1. **スキャン・内容の確認**でスキャンします。
2. 適用する電源プランや、通常終了を要求するアプリを選びます。初期選択はありません。
3. **選択した最適化を実行**で予定内容を確認します。
4. 確認した項目だけを実行します。結果は項目ごとに確認してください。

バランスから、既に存在する標準高パフォーマンスへの変更だけを提案します。プランの新規作成はしません。電源プラン変更前に復元用のintentを永続化するため、途中終了でも`pending`履歴を使った復元が可能です。電源使用量やファン動作が増える場合があります。

アプリ候補は、表示ウィンドウを持つSpotify / Teams / Chrome / Adobe Creative Cloudの固定許可リストから、ユーザー除外を適用します。PIDと開始時刻を照合し、`CloseMainWindow`による通常終了だけを要求します。強制終了や子プロセス一括終了はしません。未保存データの確認が別アプリ側に表示される場合があります。

### クリーナーの保守的な範囲

- ユーザーの一時ファイル、Windowsの一時ファイル、DirectXシェーダーキャッシュ、クラッシュログの**直下の通常ファイル**だけを対象にします。
- サブフォルダは再帰走査しません。24時間以内のファイルは対象外です。
- Windows APIで既知フォルダを解決します。任意パスや`TEMP`環境変数は削除先に使いません。
- 再解析ポイント・シンボリックリンク・ジャンクションを含むパスを除外します。
- 削除時はファイルハンドルを共有なしで開き、最終パス・サイズ・更新日時を再確認し、そのハンドルに削除を要求します。
- 使用中、変更済み、権限不足のファイルは残します。失敗しても他の項目は続行します。
- 1スキャン最大5,000ファイル、有効期限10分、実行後は再スキャンが必要です。
- **削除ファイルの復元はできません。** Shader Cacheは再生成時に一時的なスタッターが起きる可能性があります。

## 明示的な制限

このビルドは最低限の実機能を備えた初期配布用実装です。仕様書にある以下の項目は未対応または限定対応で、UIにもその状態を表示します。

- **ゲームモードの自動変更**：行いません。HKCUの`AutoGameModeEnabled`を読み、値がない場合は不明とします。Windowsのバージョン・ポリシーによる実効状態を断定しません。変更はWindows 設定 → Gaming → ゲームモードで行います。
- **GPU使用率・VRAM・CPU/GPU温度**：取得できません。GPU名は取得します。追加ドライバーは導入しません。
- **配信の最適化キャッシュ**：Windows管理対象としてUnsupported。直接削除しません。
- **Windows自動起動・最小化起動・Tray**：このビルドでは無効。Trayはv1.1候補です。
- **Update Check**：配布サーバー・署名鍵が未設定のため無効です。
- **Windows 10互換性**：x64 Windows向けの構成ですが、Windows 10実機での検証は未実施です。
- **コード署名**：証明書が提供されていないため、生成exeは未署名です。

電源プラン変更・アプリ終了の実操作を、この開発作業中にユーザーのPCへ適用して検証したわけではありません。復元の状態遷移とクリーナー削除は隔離したテスト用ファイル／設定関数で検証しています。

## ゲーム準備スコア

FPS予測ではなく、ゲーム前の準備状態の目安です。CPU 20 / RAM 20 / 空き容量15 / ネットワーク20 / ゲームモード 15 / 背景アプリ10の計100点です。閾値は`src/js/state.js`の独立関数に定義しています。

未取得のカテゴリを0点や満点に置き換えません。6カテゴリ揃うまでスコアは`— / 未確定`です。Boostスキャンと手動ネットワークテストで項目が埋まりますが、ゲームモードが不明ならスコアは未確定のままです。ネットワークの評価は5分で失効します。ジッターはタイムアウトをまたがない隣接成功Ping差の絶対値の平均です。

## 開発・ビルド

必要なもの：Windows x64、Node.js/npm、Rust 1.98以降、Visual Studio C++ Build ToolsとWindows SDK、WebView2 Runtime。

```powershell
npm ci
npm run dev
```

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
# 読み取り専用のWindows実機テスト（ローカル127.0.0.1へのPingを含む）
cargo test --manifest-path src-tauri/Cargo.toml --locked windows_read_only -- --ignored
npm run build:exe
```

exeの出力先：`src-tauri/target/release/nextune.exe`。

NSISインストーラーも生成可能な設定です：

```powershell
npm run build
```

インストーラーはユーザー単位の構成です。初回ビルドではNSISなどのビルドツール取得に通信が必要です。

ブラウザでUIだけを確認する場合：

```powershell
npm run preview
```

`http://127.0.0.1:4173`を開きます。**ブラウザプレビューでは実データ取得やOS操作はできません。** ダミー値を実機データとして表示することもありません。

プレビューを起動したまま、別ターミナルで`npm run test:ui`を実行すると、インストール済みMicrosoft Edgeを使ってナビゲーションと確認フローを再検証できます。後半のテストはテスト専用IPC fixtureを使用し、実OS変更を行いません。スクリーンショットは`work/screenshots/`へ保存します。

## 構成と安全性

- `src/js/pages/`：8画面。1枚のHTMLのmain領域だけを切り替えるSPA。
- `src/js/tauri-api.js`：Tauri invoke境界とエラー正規化。
- `src-tauri/src/commands.rs`：IPC、操作ロック、スキャンの照合と有効期限。
- `cleaner.rs` / `optimizer.rs` / `restore.rs`：スキャン、変更、復元を分離。
- `platform.rs`：絶対パスのWindowsコマンド、固定PowerShell、40秒のタイムアウト。
- `settings.rs`：一時ファイルへの書き込みと原子的な置換。ログは固定イベント名のみ。
- `capabilities/main.json`：メインウィンドウのみ。広いshell/fs/http/process権限は付与しません。

Defender、Update、Windowsサービス、BCD、HPET、Timer Resolution、TCP設定、DNS設定、ドライバー、セキュリティ、アンチチートには変更を加えません。テレメトリー、広告、アカウント、外部フォントやCDNはありません。

実装時に確認した一次資料：[Tauri v2 configuration](https://v2.tauri.app/reference/config/)、[sysinfo](https://docs.rs/sysinfo/0.33.1/sysinfo/)、[Windows PDH counter values](https://learn.microsoft.com/en-us/windows/win32/api/pdh/ns-pdh-pdh_fmt_countervalue)。


## 公開配布用プレビュー：メモリ整理とアプリ管理

ダッシュボードの「1クリックで整理」で、最小化された Chrome / Edge / Firefox / Teams / Spotify / Creative Cloud のウィンドウを持つプロセスを整理します。除外設定を優先し、初期設定では Spotify は対象外です。対象がない場合も結果を明示します。60秒以内の連続実行は受け付けません。

Windows の EmptyWorkingSet を使用します。表示する減少量は対象プロセスのワーキングセットの実行直前・直後の差の合計で、PC全体の空きRAMの増加量ではありません。共有ページの重複もあり、再使用するとメモリは戻ります。再表示が遅くなる可能性があり、FPS向上やメモリ不足の恒久的解決を保証しません。ゲーム・全システムの一括整理、スタンバイリスト破棄、定期自動実行はありません。

「アプリ管理」は同じWindowsセッションでウィンドウを持つアプリをメモリ使用量順に表示します。検索・一覧更新・個別の終了確認に対応。終了時にPIDと起動時刻を再照合し、通常終了だけを要求します。終了要求の受付と実際の終了は区別します。アプリ側の保存確認やトレイ常駐により残ることがあります。主要なWindowsシステム画面と除外設定のアプリは一覧に出しません。メモリ使用量はプロセス単体で、子プロセスを含むアプリ全体の合計ではありません。

公開用ファイルは未署名のプレビューです。コード署名・公開URL・自動更新配信は未設定です。一般公開前に別のWindows環境でインストール／アンインストールと対象アプリでの動作を確認してください。依存ライセンスは THIRD_PARTY_NOTICES.md に同梱しています。Microsoft PC Manager と同一の機能・内部処理を再現するものではありません。

参考：[EmptyWorkingSet](https://learn.microsoft.com/en-us/windows/win32/api/psapi/nf-psapi-emptyworkingset)、[Working Set](https://learn.microsoft.com/en-us/windows/win32/memory/working-set)。

## Code signing policy

Free code signing provided by [SignPath.io](https://signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

Official NexTune Windows release artifacts are built from this public repository through GitHub Actions and are submitted to SignPath according to the project's [Code signing policy](CODE_SIGNING_POLICY.md).

NexTune does not transfer information to other networked systems unless the user explicitly starts a network diagnostic or otherwise requests the network operation.

Created by KaN.  
inspired by VyLite.
