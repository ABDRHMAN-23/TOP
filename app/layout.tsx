import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'AqarFlow — ملك التسويق العقاري', template: '%s | AqarFlow' },
  description: 'منظومة مبيعات عقارية تساعد المكتب على فهم العملاء، ومعالجة الاعتراضات، وتحويل المحادثات إلى خطوات بيع مناسبة مع الحفاظ على الصدق وأخلاق المهنة.',
  applicationName: 'AqarFlow',
  keywords: ['AqarFlow', 'منظومة مبيعات عقارية', 'تسويق عقاري', 'أتمتة واتساب للمكاتب العقارية', 'إدارة العملاء العقاريين'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'AqarFlow',
    title: 'AqarFlow — منظومة المبيعات العقارية',
    description: 'منظومة مبيعات تساعد المكتب على فهم العملاء، ومعالجة الاعتراضات، وتحويل المحادثات إلى خطوات بيع مناسبة.',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'AqarFlow — منظومة المبيعات العقارية',
    description: 'مبيعات عقارية أكثر فاعلية: محادثات محترمة، مطابقة دقيقة للعقارات، وإقناع أخلاقي.',
  },
  robots: { index: true, follow: true },
  other: { 'mobile-web-app-capable': 'yes', 'theme-color': '#12392f' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body className={inter.className}>{children}</body></html>;
}
