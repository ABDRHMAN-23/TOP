import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'QUVOTO — Speak. Quote. Done.',
    short_name: 'QUVOTO',
    description: 'Fast voice-first quoting for contractors.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1769E0',
    orientation: 'portrait',
    lang: 'en',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    icons: [
      { src: '/quvoto-logo.jpg?v=18', sizes: '256x256', type: 'image/jpeg', purpose: 'any' },
    ],
  };
}
