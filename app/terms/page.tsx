import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | QUVOTO',
  description: 'Terms governing the use of QUVOTO.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-[#0A1E3D]">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <Link href="/" className="text-sm font-bold text-[#1769E0]">← Back to QUVOTO</Link>
        <header className="mt-8 border-b border-slate-200 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1769E0]">QUVOTO Legal</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Terms of Service</h1>
          <p className="mt-3 text-sm text-slate-500">Version 2026-10-02 · Effective 2 October 2026</p>
        </header>

        <div className="prose prose-slate mt-10 max-w-none">
          <p><strong>Important:</strong> These terms are a product baseline and should be reviewed by a qualified lawyer before commercial launch in the countries you target. They do not attempt to remove rights or liabilities that applicable law does not permit you to exclude.</p>

          <h2>1. Service</h2>
          <p>QUVOTO provides software tools for creating, organizing, reviewing, sharing and managing business quotes and related workflow information. Features, limits and integrations may change as the service develops.</p>

          <h2>2. Eligibility and account</h2>
          <p>You must provide accurate account information and keep your credentials and devices reasonably secure. You are responsible for activity performed through your account, except where applicable law provides otherwise or the activity resulted from QUVOTO&apos;s failure to meet its obligations.</p>

          <h2>3. Your content and customer data</h2>
          <p>You retain your rights in content you submit to QUVOTO. You grant QUVOTO the limited rights necessary to host, process, render, transmit and otherwise provide that content as part of the service. You represent that you have the necessary rights or permissions to submit content and personal information belonging to other people.</p>

          <h2>4. Quotes and AI output</h2>
          <p>QUVOTO assists with quote preparation. AI-generated transcriptions, extracted fields, classifications and other output may contain mistakes. You are solely responsible for reviewing and approving a quote before sending it to a customer or relying on it for a business decision.</p>
          <p>QUVOTO does not determine your prices, guarantee profitability, guarantee tax treatment, or provide legal, accounting, engineering or other regulated professional advice. You remain responsible for prices, quantities, taxes, compliance, scope and contractual terms in the quote you send.</p>

          <h2>5. Customer-facing links</h2>
          <p>You are responsible for the information you choose to include in public quote links and for using those links appropriately. Anyone who obtains a public link may be able to view the information exposed by that link.</p>

          <h2>6. Acceptable use</h2>
          <p>You may not use QUVOTO to violate law, infringe another person&apos;s rights, distribute malicious code, attempt unauthorized access, interfere with the service, abuse automated systems, impersonate another person, or submit data you are not authorized to process.</p>

          <h2>7. Plans, limits and payments</h2>
          <p>QUVOTO may offer Free and paid plans with different quote and feature limits. Prices, taxes, renewal terms, billing intervals and applicable refunds are shown at checkout or in the applicable plan information. Paid subscriptions may be processed by a third-party payment provider.</p>

          <h2>8. Free plan and changes</h2>
          <p>Free access may be subject to usage limits. We may change plan features or limits prospectively, subject to applicable law and any commitments made to you.</p>

          <h2>9. Suspension and termination</h2>
          <p>We may restrict or suspend access when reasonably necessary to address security, fraud, abuse, non-payment, unlawful use or material breach. Where appropriate, we will provide notice and an opportunity to resolve the issue. Mandatory legal rights are not excluded.</p>

          <h2>10. Your data after downgrade or non-payment</h2>
          <p>Where QUVOTO retains your data after a downgrade or non-payment, your access to certain paid features may become read-only or otherwise limited. Retention does not guarantee indefinite availability, and legal or operational retention rules may apply.</p>

          <h2>11. Availability and third-party services</h2>
          <p>QUVOTO depends on internet connectivity and third-party infrastructure. We aim for reliable service but do not promise uninterrupted or error-free availability. Third-party services are subject to their own terms and policies.</p>

          <h2>12. Security</h2>
          <p>We use reasonable safeguards to protect the service and data, but no internet service can guarantee absolute security. You should use strong authentication practices and report suspected unauthorized access promptly.</p>

          <h2>13. Intellectual property</h2>
          <p>QUVOTO software, branding, interface and service materials are owned by or licensed to the operator and are protected by applicable law. These terms do not transfer ownership of QUVOTO intellectual property to you.</p>

          <h2>14. Feedback</h2>
          <p>If you voluntarily provide suggestions or feedback, you allow QUVOTO to use it to improve the service without owing you compensation, while not using your confidential business content as public marketing material without appropriate permission.</p>

          <h2>15. Disclaimers and liability</h2>
          <p>To the maximum extent permitted by applicable law, QUVOTO is provided without guarantees that every AI output, quote, estimate, document, notification or workflow result will be accurate or suitable for every purpose. Nothing in these terms excludes liability or rights that cannot legally be excluded or limited.</p>
          <p>Where legally permitted, QUVOTO will not be responsible for indirect, incidental, special or consequential losses arising from use of the service. Any applicable liability cap must be interpreted subject to mandatory consumer, privacy and other legal protections in the user&apos;s jurisdiction.</p>

          <h2>16. Indemnity</h2>
          <p>Where permitted by applicable law, you agree to protect the operator from third-party claims arising from your unlawful use of QUVOTO, your violation of these terms, or content you submit without the necessary rights or permissions. This does not apply to the extent a claim results from matters for which the operator is legally responsible.</p>

          <h2>17. Governing law</h2>
          <p>The governing law and courts for QUVOTO should be stated only after the operator&apos;s legal residence, business structure and target-market requirements have been reviewed. Nothing here removes mandatory protections that apply to users under the law that governs their relationship with QUVOTO.</p>

          <h2>18. Changes</h2>
          <p>We may update these terms when the service or legal requirements change. Material changes will be communicated when required. Continued use after an effective change may constitute acceptance only to the extent permitted by applicable law.</p>

          <h2>19. Contact</h2>
          <p>Questions about these terms should be submitted through the official QUVOTO support/contact channel. Before launch, the operator should publish a monitored legal contact address.</p>

          <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="m-0 text-sm font-semibold text-[#0A1E3D]">Privacy</p>
            <Link href="/privacy" className="mt-3 inline-block text-sm font-bold text-[#1769E0]">Read the Privacy Policy</Link>
          </div>
        </div>
      </div>
    </main>
  );
}