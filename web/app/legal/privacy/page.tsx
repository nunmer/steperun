import type { Metadata } from "next";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${LEGAL_CONFIG.company} collects, uses, and protects your personal data.`,
};

const { company: COMPANY, country: COUNTRY, contactEmail: CONTACT_EMAIL, effectiveDate: EFFECTIVE_DATE } = LEGAL_CONFIG;

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

      <p>
        This Privacy Policy describes how {COMPANY} (the &ldquo;Operator&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, stores, and shares personal data of users of the
        Service. We process personal data in accordance with the Law of the {COUNTRY}
        &ldquo;On Personal Data and Its Protection&rdquo; No. 94-V dated 21 May 2013 (the
        &ldquo;Personal Data Law&rdquo;) and other applicable legislation.
      </p>

      <h2>1. Data Controller</h2>
      <p>
        The data controller (Operator) is {COMPANY}, contactable at
        {" "}<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Personal Data We Collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> &mdash; provided by your authentication provider
          (typically Google): email address, display name, profile picture URL, and a stable user
          identifier.
        </li>
        <li>
          <strong>Profile data</strong> &mdash; runner profile claim information (full name,
          city, country) submitted by you, and verification evidence you choose to provide.
        </li>
        <li>
          <strong>Strava data</strong> &mdash; if you connect Strava: athlete ID, OAuth tokens,
          and activity metadata (distance, pace, dates) used for training analytics.
        </li>
        <li>
          <strong>AI Coach uploads</strong> &mdash; video files you upload, extracted frames, and
          AI-generated analysis output.
        </li>
        <li>
          <strong>Transaction data</strong> &mdash; record of Coin balance, awards, debits, and
          purchases.
        </li>
        <li>
          <strong>Technical data</strong> &mdash; IP address, browser user agent, device type,
          access logs, and similar diagnostic information.
        </li>
      </ul>

      <h2>3. Public Race Results</h2>
      <p>
        The Service also displays running event results that are publicly published by event
        organisers on their official websites. These results (name, city, finish time, place,
        etc.) are aggregated for informational purposes. If you wish to be excluded, contact us at
        {" "}{CONTACT_EMAIL} and we will remove your record within a reasonable period.
      </p>

      <h2>4. Purposes of Processing and Legal Basis</h2>
      <ul>
        <li>to create and operate your account &mdash; performance of a contract (Article 9 of the Personal Data Law);</li>
        <li>to verify runner profile claims and email you the outcome of your claim &mdash; your consent;</li>
        <li>to provide training analytics from Strava &mdash; your consent and contract;</li>
        <li>to deliver AI Coach analysis &mdash; performance of a contract and your consent to processing of uploaded video;</li>
        <li>to process Coin purchases and prevent fraud &mdash; performance of a contract and legitimate interests;</li>
        <li>to comply with legal obligations &mdash; statutory requirements.</li>
      </ul>

      <h2>5. Consent</h2>
      <p>
        By creating an account and using the Service, you provide consent to the collection and
        processing of your personal data for the purposes described above. You may withdraw consent
        at any time by deleting your account or by contacting {CONTACT_EMAIL}. Withdrawal does not
        affect the lawfulness of processing performed prior to withdrawal.
      </p>

      <h2>6. Sharing and Disclosure</h2>
      <p>We share personal data only with:</p>
      <ul>
        <li>
          <strong>Sub-processors</strong> acting on our instructions, including: Supabase
          (database and storage), Vercel (hosting), Google (authentication), Strava (training data
          integration), Resend (transactional email, such as claim decisions), and AI model
          providers used by AI Coach for inference.
        </li>
        <li>
          <strong>Payment processors</strong> when you purchase Coins. We do not store full
          payment card numbers on our servers.
        </li>
        <li>
          <strong>Authorities</strong> when required by law, court order, or to protect the
          rights, property, or safety of the Operator or others.
        </li>
      </ul>
      <p>
        Some sub-processors may process data outside the {COUNTRY}. Where such cross-border
        transfer occurs, we ensure adequate protection in accordance with Article 16 of the
        Personal Data Law.
      </p>

      <h2>7. Data Retention</h2>
      <p>
        We retain personal data for as long as your account is active and for a reasonable period
        thereafter to comply with legal obligations, resolve disputes, and enforce our agreements.
        AI Coach video files and extracted frames are retained while the session is visible in your
        account and may be deleted at your request.
      </p>

      <h2>8. Your Rights</h2>
      <p>
        Subject to the Personal Data Law, you have the right to:
      </p>
      <ul>
        <li>access the personal data we hold about you;</li>
        <li>request rectification of inaccurate or incomplete data;</li>
        <li>request blocking or destruction of your data;</li>
        <li>withdraw consent and request deletion of your account;</li>
        <li>lodge a complaint with the authorised body for personal data protection of the {COUNTRY}.</li>
      </ul>
      <p>
        To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        We will respond within the period prescribed by applicable law.
      </p>

      <h2>9. Security</h2>
      <p>
        We apply organisational and technical measures appropriate to the risks of processing,
        including encrypted connections (HTTPS/TLS), access control, server-side handling of
        secrets, and least-privilege database policies. No method of transmission or storage is
        fully secure; we cannot guarantee absolute security.
      </p>

      <h2>10. Cookies</h2>
      <p>
        The Service uses strictly necessary cookies for authentication session management and
        preferences (e.g. theme). We do not use advertising cookies or third-party tracking
        cookies for behavioural advertising.
      </p>

      <h2>11. Children</h2>
      <p>
        The Service is not intended for children under 16. We do not knowingly collect personal
        data from children. If you believe a child has provided personal data, contact us and we
        will delete it.
      </p>

      <h2>12. Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The &ldquo;Effective date&rdquo; above
        reflects the latest revision.
      </p>

      <h2>13. Contact</h2>
      <p>
        Privacy questions and data-subject requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
