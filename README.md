# 爆裂カジノ / キャンパスフェスティバル横浜キャンパス

キャンフェス運営に必要な画面だけに整理したNext.jsアプリです。運営はSupabase Auth、参加者はQR発行時に作られるCanfes DBアカウントを使います。

## 残している機能

- 運営用Supabase Authログイン・新規登録
- 参加者用QR読み取りアカウント作成（メールアドレス・パスワード不要）
- 同じ端末からの参加者アカウント再作成防止（登録済みCookie）
- 参加者のCF残高表示
- 支払い用QRコード表示
- 利用履歴
- 参加者向けの到達景品・受け取り状況表示
- ログイン不要の人狼観客投票（運営が昼・夜を切り替え）
- 運営による参加者残高一覧と到達景品の付与管理（1,000CF・3,000CF各1回）
- PWA対応

参加登録が完了するとPWA案内へ移動します。ブラウザで開いている場合は、対応ブラウザではインストールボタンを表示し、iPhone / iPadではホーム画面への追加手順を案内します。参加者アカウントのセッションと登録済みCookieはそれぞれ1年間保持します。

1,000CF・3,000CFの景品判定は残高の過去最高額で行います。景品はチップを減らさず、運営が付与済みにした記録だけを保存します。同じ到達額の景品はアカウントごとに一度しか付与できません。

依頼、グループ残高、開発者画面、通知、学校年度管理などの不要な機能は削除しています。

## 起動

```bash
npm install
npm run dev
```

`.env.example` を参考に、キャンフェス専用のSupabaseプロジェクトを設定します。一般参加者にはSupabase Authを使わず、サーバーAPIが発行するHttpOnlyセッションを使います。

```env
NEXT_PUBLIC_CANFES_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_CANFES_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
CANFES_SUPABASE_SECRET_KEY=server-only-secret-key
CANFES_OPERATOR_INVITE_PASSWORD=server-only-operator-invite-password
```

Supabaseで [`docs/supabase-schema.sql`](./docs/supabase-schema.sql) を実行してください。Publishable Keyはブラウザ側、Secret Keyはサーバー側のAPIだけで使用します。

運営アカウントの新規作成には `CANFES_OPERATOR_INVITE_PASSWORD` が必要です。この値はVercelのEnvironment Variablesにも設定してください。確認メールの戻り先は `NEXT_PUBLIC_CANFES_APP_URL/operator/login`（未設定時はリクエスト元）になります。Supabase Dashboardの **Authentication > URL Configuration > Redirect URLs** に、そのURLを追加してください。

## 主なURL

- `/`：参加者向け入口（参加者画面を最初に表示）
- `/guest`：参加者向け入口・案内
- `/guest/scan`：参加者のQR読み取り・アカウント作成
- `/operator/login`：運営ログイン・新規登録
- `/operator`：運営の参加者QR発行
- `/operator/accounts`：運営用の参加者残高・景品付与管理
- `/dashboard`：参加者ホーム
- `/dashboard/payment`：支払いQR
- `/dashboard/history`：利用履歴
- `/dashboard/rewards`：参加者向け景品受け取り状況
- `/dashboard/account`：アカウント設定
- `/werewolf`：人狼の観客投票（ログイン不要）
- `/operator/werewolf`：運営用の人狼進行・投票集計
