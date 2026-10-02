import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app',
    name: 'QUVOTO — Speak. Quote. Done.',
    short_name: 'QUVOTO',
    description: 'Fast voice-first quoting for contractors.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1769E0',
    orientation: 'portrait',
    icons: [
      { src: '/icon.webp?v=12', sizes: '831x831', type: 'image/webp', purpose: 'any' },
    ],
  };
}
