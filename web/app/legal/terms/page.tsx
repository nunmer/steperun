import type { Metadata } from "next";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing the use of ${LEGAL_CONFIG.company}.`,
};

const { company: COMPANY, country: COUNTRY, contactEmail: CONTACT_EMAIL, effectiveDate: EFFECTIVE_DATE } = LEGAL_CONFIG;

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        These Terms of Service (the &ldquo;Terms&rdquo;) govern your access to and use of the
        {" "}{COMPANY} website and related services (the &ldquo;Service&rdquo;), operated from the
        {" "}{COUNTRY}. By creating an account, purchasing coins, or otherwise using the
        Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 16 years old to use the Service. If you use the Service on behalf of
        a legal entity, you represent that you have authority to bind that entity to these Terms.
      </p>

      <h2>3. Accounts</h2>
      <p>
        Authentication is provided through third-party identity providers (e.g. Google). You are
        responsible for maintaining the confidentiality of your credentials and for all activity
        that occurs under your account. Notify us immediately at {CONTACT_EMAIL} of any
        unauthorized access.
      </p>

      <h2>4. Service Description</h2>
      <p>
        {COMPANY} provides a publicly compiled database of running event results in Almaty and
        related analytics, ranking, head-to-head comparison, training, and AI-assisted technique
        review features. The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo; basis. We may modify, suspend, or discontinue any part of the Service at
        any time without notice.
      </p>

      <h2>5. Coins and Paid Features</h2>
      <p>
        Certain features (including AI Coach) require expenditure of virtual coins
        (the &ldquo;Coins&rdquo;). Coins may be obtained by:
      </p>
      <ul>
        <li>completing eligible actions (e.g. profile claim, Strava connection, race participation);</li>
        <li>purchasing them through the Service.</li>
      </ul>
      <p>
        Coins have no monetary value, cannot be exchanged for cash, and are non-transferable
        between accounts. All Coin balances are tied to the user account on which they were
        earned or purchased. Coins do not expire unless the account is deleted or terminated under
        Section 9.
      </p>
      <p>
        Prices are listed in Kazakhstani Tenge (KZT, ₸) and include applicable taxes where required.
        Refunds are governed by our <a href="/legal/refund">Refund Policy</a>.
      </p>

      <h2>6. User Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>impersonate another runner or claim a profile that does not represent you;</li>
        <li>upload content that is unlawful, infringing, harassing, or contains malware;</li>
        <li>scrape, reverse engineer, or interfere with the Service;</li>
        <li>attempt to gain unauthorized access to accounts, systems, or data;</li>
        <li>use the AI Coach feature to upload videos of other persons without their consent.</li>
      </ul>

      <h2>7. User Content</h2>
      <p>
        You retain ownership of content you upload (e.g. videos submitted to AI Coach). You grant
        {" "}{COMPANY} a non-exclusive, worldwide, royalty-free license to host, store, process,
        and display that content solely for the purpose of operating and improving the Service.
        You represent that you have all necessary rights to grant this license.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        All trademarks, logos, source code, design, and compiled databases of the Service are the
        property of {COMPANY} or its licensors and are protected by the laws of the {COUNTRY} and
        applicable international treaties. Race results data is sourced from publicly available
        event websites and is presented for informational purposes.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your account at any time for breach of these Terms, fraudulent
        activity, or as required by law. Upon termination, your right to use the Service ceases
        immediately and any unused Coins are forfeited, except where applicable law requires
        otherwise.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service, including AI-generated technique feedback, is provided for informational and
        entertainment purposes only and does not constitute medical, coaching, or professional
        advice. Consult a qualified professional before acting on any output.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, {COMPANY} shall not be liable for any indirect,
        incidental, consequential, or punitive damages, or any loss of profits, revenue, data, or
        goodwill arising out of or in connection with your use of the Service. Our total
        cumulative liability for any claim shall not exceed the amount you paid us in the twelve
        (12) months preceding the event giving rise to the claim.
      </p>

      <h2>12. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of the {COUNTRY}. Any dispute arising from these
        Terms shall be submitted to the courts at the location of {COMPANY}, in accordance with
        the procedural legislation of the {COUNTRY}. Consumers retain all mandatory protections
        granted by the Law of the Republic of Kazakhstan &ldquo;On Protection of Consumer
        Rights&rdquo; No. 274-IV dated 4 May 2010.
      </p>

      <h2>13. Changes to the Terms</h2>
      <p>
        We may update these Terms from time to time. The &ldquo;Effective date&rdquo; above
        reflects the latest revision. Continued use of the Service after changes are posted
        constitutes acceptance of the revised Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
