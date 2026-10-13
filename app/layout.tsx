import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'سِنان | مساحة العمل السريرية للأسنان',
  description: 'مساحة عمل سريرية تساعد طبيب الأسنان على توثيق الزيارة ومراجعتها واعتمادها.',
  applicationName: 'Sinan Clinical Workspace',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
