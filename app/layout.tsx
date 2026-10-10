import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'AqarFlow AI — منصة المبيعات العقارية الذكية', template: '%s | AqarFlow AI' },
  description: 'واجهة AqarFlow AI لإدارة العملاء المحتملين والعقارات ومتابعات المبيعات والتقارير في مكان واحد.',
  applicationName: 'AqarFlow AI',
  keywords: ['AqarFlow AI', 'إدارة العقارات', 'CRM عقاري', 'المبيعات العقارية', 'إدارة العملاء المحتملين'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'AqarFlow AI',
    title: 'AqarFlow AI — منصة المبيعات العقارية الذكية',
    description: 'واجهة موحّدة لإدارة العقارات والعملاء ومتابعات المبيعات.',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'AqarFlow AI — منصة المبيعات العقارية الذكية',
    description: 'واجهة موحّدة لإدارة العقارات والعملاء ومتابعات المبيعات.',
  },
  robots: { index: true, follow: true },
  other: { 'mobile-web-app-capable': 'yes', 'theme-color': '#1d4ed8' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body className={inter.className}>{children}</body></html>;
}
