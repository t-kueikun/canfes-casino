import type { Metadata } from 'next';
import './styles/global.css';
import InitSettings from './components/InitSettings';

export const metadata: Metadata = {
  metadataBase: new URL('https://canfes-casino.example.com'),
  title: '爆裂カジノ | キャンパスフェスティバル横浜キャンパス',
  description: 'キャンパスフェスティバル横浜キャンパスのデジタルカジノ',
  icons: {
    icon: '/festa-casino.svg',
  },
  openGraph: {
    title: '爆裂カジノ | キャンパスフェスティバル横浜キャンパス',
    description: 'キャンパスフェスティバル横浜キャンパスのデジタルカジノ',
    type: 'website',
    images: [
      {
        url: '/canfes-ogp.png',
        width: 1200,
        height: 630,
        alt: '爆裂カジノ OGP',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '爆裂カジノ',
    description: 'CFの取引をスムーズに。デジタルで。',
    images: ['/canfes-ogp.png'],
  },
};

export const viewport = {
  themeColor: '#0099D9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head />
      <body>
        <InitSettings />
        {children}
      </body>
    </html>
  );
}
