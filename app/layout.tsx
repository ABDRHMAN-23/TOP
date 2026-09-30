import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata={title:'VoiceQuote — Professional quotes from your voice',description:'Turn contractor voice notes into professional quote PDFs.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
