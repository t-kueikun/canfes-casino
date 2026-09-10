import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '爆裂カジノ | キャンパスフェスティバル横浜キャンパス',
    short_name: '爆裂カジノ',
    description: 'キャンパスフェスティバル横浜キャンパスのデジタルカジノ',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0099D9',
    lang: 'ja-JP',
    icons: [
      // SVG is widely supported by modern browsers for PWA icons
      {
        src: '/festa-casino.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      // If you later add PNG icons, include them here:
      // { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      // { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
