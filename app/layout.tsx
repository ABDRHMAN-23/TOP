import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'AqarFlow — اكتشف العقارات للبيع والإيجار', template: '%s | AqarFlow AI' },
  description: 'تصفح عقارات للبيع والإيجار في عدن. قارن الأسعار والمساحات والصور وافتح تفاصيل كل عقار في تجربة تفاعلية.',
  applicationName: 'AqarFlow AI',
  keywords: ['AqarFlow', 'عقارات عدن', 'عقارات للبيع', 'عقارات للإيجار', 'شقق وفلل'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'AqarFlow AI',
    title: 'AqarFlow AI — منصة المبيعات العقارية الذكية',
    description: 'اكتشف عقارات للبيع والإيجار، وتصفح الصور والمواصفات ومعلومات التواصل.',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'AqarFlow AI — منصة المبيعات العقارية الذكية',
    description: 'واجهة موحّدة لإدارة العقارات والعملاء ومتابعات المبيعات.',
  },
  robots: { index: true, follow: true },
  other: { 'mobile-web-app-capable': 'yes', 'theme-color': '#13212e' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body className={inter.className}>{children}</body></html>;
}
