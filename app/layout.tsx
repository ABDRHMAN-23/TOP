import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'AqarFlow AI — ملك التسويق العقاري', template: '%s | AqarFlow AI' },
  description: 'مساعد مبيعات عقاري يفهم العميل، ويتعامل مع الاعتراضات، ويقترح العقار المناسب من مخزون المكتب، مع الحفاظ على الصدق وأخلاق المهنة.',
  applicationName: 'AqarFlow AI',
  keywords: ['AqarFlow AI', 'مساعد مبيعات عقاري', 'تسويق عقاري', 'أتمتة واتساب للمكاتب العقارية', 'إدارة العملاء العقاريين'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'AqarFlow AI',
    title: 'AqarFlow AI — منصة المبيعات العقارية الذكية',
    description: 'عقل مبيعات عقاري يساعد المكتب على فهم العملاء، ومعالجة الاعتراضات، وتحويل المحادثات إلى خطوات بيع مناسبة.',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'AqarFlow AI — منصة المبيعات العقارية الذكية',
    description: 'مبيعات عقارية أذكى: محادثات محترمة، مطابقة دقيقة للعقارات، وإقناع أخلاقي.',
  },
  robots: { index: true, follow: true },
  other: { 'mobile-web-app-capable': 'yes', 'theme-color': '#12392f' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body className={inter.className}>{children}</body></html>;
}
