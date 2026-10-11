import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'AqarFlow AI — ملك التسويق العقاري',
    template: '%s | AqarFlow AI',
  },
  description: 'مساعد مبيعات عقاري يفهم احتياجات العملاء، يعالج الاعتراضات باحترام، ويقترح بدائل من بيانات مكتبك الحقيقية عبر محادثات منظمة وتكامل واتساب.',
  applicationName: 'AqarFlow AI',
  keywords: [
    'AqarFlow AI',
    'المساعد العقاري الذكي',
    'تسويق عقاري',
    'مبيعات عقارية',
    'مساعد واتساب للمكاتب العقارية',
    'إدارة بيانات العقارات',
    'الرد على العملاء العقاريين',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'AqarFlow AI',
    title: 'AqarFlow AI — ملك التسويق العقاري',
    description: 'مساعد مبيعات عقاري يجمع بين التسويق الذكي، فهم الاعتراضات، والبيانات الموثقة لكل مكتب.',
    url: '/',
    locale: 'ar_YE',
  },
  twitter: {
    card: 'summary',
    title: 'AqarFlow AI — ملك التسويق العقاري',
    description: 'مساعد مبيعات عقاري يفهم العميل، يقترح البدائل المناسبة، ويحافظ على هيبة المكتب.',
  },
  robots: { index: true, follow: true },
  other: { 'mobile-web-app-capable': 'yes', 'theme-color': '#173d32' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body className={inter.className}>{children}</body></html>;
}
