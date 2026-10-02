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
      { src: '/icon.svg?v=13', sizes: '256x256', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  };
}
