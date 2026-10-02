import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | QUVOTO',
  description: 'How QUVOTO collects, uses, protects and retains personal information.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-[#0A1E3D]">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <Link href="/" className="text-sm font-bold text-[#1769E0]">← Back to QUVOTO</Link>
        <header className="mt-8 border-b border-slate-200 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1769E0]">QUVOTO Legal</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-sm text-slate-500">Version 2026-10-02 · Effective 2 October 2026</p>
        </header>

        <div className="prose prose-slate mt-10 max-w-none">
          <p><strong>Important:</strong> This policy is a product privacy baseline, not a guarantee that QUVOTO is exempt from any law or liability. The legal entity/operator, applicable law and third-party processing arrangements must be kept accurate as QUVOTO grows.</p>

          <h2>1. Who operates QUVOTO</h2>
          <p>QUVOTO is currently operated as an independent software service by its operator, rather than representing that it is a corporation or limited company unless a legal entity is expressly identified on the service. References to “QUVOTO”, “we”, “us” or “our” mean the operator of the QUVOTO service.</p>

          <h2>2. Information we collect</h2>
          <p>Depending on the features you use, QUVOTO may process account information such as your name, email address and authentication identifiers; business profile information such as business name, logo, phone, email, address and tax information; quote information such as customers, addresses, items, quantities, prices, taxes, discounts, notes, photos and status; subscription and billing information; and technical, security and diagnostic information needed to operate and protect the service.</p>

          <h2>3. Google and other sign-in providers</h2>
          <p>If QUVOTO offers Google or another third-party sign-in option and you choose it, the provider shares the account information permitted by its authentication flow and your settings. QUVOTO uses that information to create or authenticate your QUVOTO account. QUVOTO does not receive unrestricted access to your Google account.</p>

          <h2>4. Voice recordings and AI processing</h2>
          <p>When you use voice quoting, QUVOTO may process your audio recording, transcription and structured information extracted from it to provide the quoting feature. Audio and AI processing may involve service providers selected by QUVOTO. We do not represent that AI output is error-free. You must review names, quantities, prices, taxes, descriptions and other quote information before sending or relying on a quote.</p>
          <p>QUVOTO is not a substitute for professional legal, tax, accounting, engineering or other regulated advice. We do not intentionally use your quote or customer data to train a general-purpose AI model unless the applicable terms and privacy notice expressly say otherwise.</p>

          <h2>5. Customer and job information</h2>
          <p>If you enter information about your own customers, workers or other people, you are responsible for using QUVOTO in accordance with the laws that apply to you and for having any required authority or lawful basis to provide that information to us.</p>

          <h2>6. Public quote links</h2>
          <p>When you create and share a public quote link, information included in that quote can be accessible to anyone who obtains the link. Do not include information that you do not intend to share through the public quote.</p>

          <h2>7. Why we use information</h2>
          <ul>
            <li>To create and manage accounts and authenticate users.</li>
            <li>To create, store, render, send and display quotes and related documents.</li>
            <li>To provide customer, job, follow-up, notification and referral features.</li>
            <li>To process subscriptions, billing and account entitlements.</li>
            <li>To prevent abuse, fraud, unauthorized access and security incidents.</li>
            <li>To troubleshoot errors, maintain reliability and provide support.</li>
            <li>To comply with applicable legal obligations and respond to lawful requests.</li>
          </ul>

          <h2>8. Service providers</h2>
          <p>QUVOTO may use carefully selected providers for authentication, database and storage infrastructure, hosting, email delivery, payments, AI processing, PDF generation, push notifications and security. Providers receive only the information needed for the service they provide and are subject to their own applicable terms and privacy policies.</p>
          <p>Current or planned providers may include Supabase, Cloudflare, Resend, Lemon Squeezy, Google and AI infrastructure providers. The actual providers used in production may change as the service evolves.</p>

          <h2>9. Payments</h2>
          <p>Paid subscriptions may be processed through Lemon Squeezy. QUVOTO does not need to store your full payment-card number when payment processing is handled by the payment provider. Billing records and subscription status may be stored by QUVOTO to operate your account.</p>

          <h2>10. International processing</h2>
          <p>QUVOTO and its service providers may process information in countries other than the country where you live. Where applicable law requires safeguards for international transfers, we will use the safeguards required by that law.</p>

          <h2>11. Data retention</h2>
          <p>We retain information for as long as reasonably necessary to provide the service, maintain account and billing records, preserve security and comply with legal obligations. Retention periods may differ by data type. Where an account is deleted, some information may need to remain for legal, accounting, fraud-prevention or dispute-resolution purposes.</p>

          <h2>12. Your choices and privacy rights</h2>
          <p>Depending on where you live and which law applies, you may have rights such as access, correction, deletion, restriction, objection, portability and withdrawal of consent where consent is the legal basis. Some rights have legal conditions and exceptions. You may contact QUVOTO to exercise applicable rights.</p>

          <h2>13. Security</h2>
          <p>We use reasonable technical and organizational safeguards appropriate to the service, including encrypted connections, access controls, row-level database controls where applicable, server-side authorization, secret management, webhook verification, input validation and security monitoring. No internet service can guarantee that unauthorized access, data loss or security incidents are impossible.</p>

          <h2>14. Security incidents</h2>
          <p>If QUVOTO becomes aware of a security incident involving personal information, we will investigate and take the steps required by applicable law, which may include notifying affected users or regulators when legally required.</p>

          <h2>15. Cookies and similar technologies</h2>
          <p>QUVOTO uses essential cookies and browser storage where needed for authentication, security, referrals and core functionality. If non-essential analytics or advertising technologies are introduced, the applicable notice and consent controls will be updated where required.</p>

          <h2>16. Notifications and push</h2>
          <p>If you enable browser or device notifications, QUVOTO may store the push subscription needed to deliver notifications to your device. You can disable browser notifications through your browser or device settings.</p>

          <h2>17. Children</h2>
          <p>QUVOTO is a business productivity service and is not directed to children. We do not knowingly seek to collect personal information from children where prohibited by applicable law.</p>

          <h2>18. Account deletion and requests</h2>
          <p>You may request account deletion or privacy assistance through the support/contact channel made available by QUVOTO. We may need to verify the request and may retain limited information where required or permitted by law.</p>

          <h2>19. Changes to this policy</h2>
          <p>We may update this policy when the service, providers or legal requirements change. We will update the version and effective date. Where applicable law requires additional notice or consent for a material change, we will provide it.</p>

          <h2>20. Contact</h2>
          <p>Privacy requests should be submitted through the official QUVOTO support/contact channel. Before launch, the operator should publish a monitored privacy contact address and keep it current.</p>

          <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="m-0 text-sm font-semibold text-[#0A1E3D]">Related legal documents</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
              <Link href="/terms" className="text-[#1769E0]">Terms of Service</Link>
              <Link href="/login" className="text-[#1769E0]">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}