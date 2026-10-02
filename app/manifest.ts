import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'QUVOTO — Speak. Quote. Done.',
    short_name: 'QUVOTO',
    description: 'Fast voice-first quoting for contractors.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1769E0',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: '64x64', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  };
}