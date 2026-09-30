import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://voicequote.com'),
  title: {
    default: 'VoiceQuote — AI Voice Quotes for Contractors',
    template: '%s | VoiceQuote',
  },
  description: 'Turn a contractor voice note into a professional, editable quote in seconds. VoiceQuote uses speech-to-text and AI to structure job details, pricing and notes into a customer-ready quote.',
  applicationName: 'VoiceQuote',
  keywords: [
    'voice quote software',
    'AI quote generator for contractors',
    'contractor quoting software',
    'plumber quote software',
    'electrician quote software',
    'voice to quote',
    'AI estimating software',
    'quote PDF generator',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'VoiceQuote',
    title: 'VoiceQuote — AI Voice Quotes for Contractors',
    description: 'Speak your job notes. Get a professional quote ready to review and send.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VoiceQuote — AI Voice Quotes for Contractors',
    description: 'Turn field voice notes into professional customer-ready quotes.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
};

export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body className={inter.className}>{children}</body></html>;
}
