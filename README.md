# 爆裂カジノ / キャンパスフェスティバル横浜キャンパス

キャンフェス運営に必要な画面だけに整理したNext.jsアプリです。運営はSupabase Auth、参加者はQR発行時に作られるCanfes DBアカウントを使います。

## 残している機能

- 運営用Supabase Authログイン・新規登録
- 参加者用QR読み取りアカウント作成（メールアドレス・パスワード不要）
- 参加者のCF残高表示
- 支払い用QRコード表示
- 利用履歴
- ビンゴカードの初回無料発行・追加購入
- スタッフによるビンゴ番号抽選
- PWA対応

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
```

Supabaseで [`docs/supabase-schema.sql`](./docs/supabase-schema.sql) を実行してください。Publishable Keyはブラウザ側、Secret Keyはサーバー側のAPIだけで使用します。

運営アカウントの確認メールを正しい画面へ戻すため、Supabase Dashboardの **Authentication > URL Configuration > Redirect URLs** に、利用するURLを追加してください。例：`http://localhost:3000/operator/login`、`http://localhost:3001/operator/login`、`http://192.168.86.124:3001/operator/login`。メールのリンク先はアクセスした画面のURLを自動的に使います。

## 主なURL

- `/`：参加者向け入口（参加者画面を最初に表示）
- `/guest`：参加者向け入口・案内
- `/guest/scan`：参加者のQR読み取り・アカウント作成
- `/operator/login`：運営ログイン・新規登録
- `/operator`：運営の参加者QR発行
- `/dashboard`：参加者ホーム
- `/dashboard/payment`：支払いQR
- `/dashboard/history`：利用履歴
- `/dashboard/bingo`：ビンゴカード
- `/dashboard/bingo/control`：スタッフ用ビンゴ抽選
- `/dashboard/account`：アカウント設定
