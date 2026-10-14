import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from './i18n';

export const metadata: Metadata = {
  title: 'Sinan | Dental Clinical Workspace',
  description: 'A secure dental clinical workspace for patient records, visit documentation, review, and reports.',
  applicationName: 'Sinan Clinical Workspace',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
