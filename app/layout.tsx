import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from './i18n';

export const metadata: Metadata = {
  title: 'Sinan | Dental Clinical Workspace',
  description: 'A secure dental clinical workspace for patient records, visit documentation, review, and reports.',
  applicationName: 'Sinan Clinical Workspace',
  icons: { icon: [{ url: '/sinan-icon.webp', type: 'image/webp', sizes: '256x256' }], shortcut: '/sinan-icon.webp', apple: '/sinan-icon.webp' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
