import type { Metadata } from "next";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: `Refund terms for Coin purchases on ${LEGAL_CONFIG.company}.`,
};

const { company: COMPANY, country: COUNTRY, contactEmail: CONTACT_EMAIL, effectiveDate: EFFECTIVE_DATE } = LEGAL_CONFIG;

export default function RefundPage() {
  return (
    <>
      <h1>Refund Policy</h1>
      <p className="text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>

      <p>
        This Refund Policy applies to purchases of virtual coins (&ldquo;Coins&rdquo;) made on
        {" "}{COMPANY} (the &ldquo;Service&rdquo;). It is issued in accordance with the Law of the
        {" "}{COUNTRY} &ldquo;On Protection of Consumer Rights&rdquo; No. 274-IV dated
        4 May 2010.
      </p>

      <h2>1. Nature of Coins</h2>
      <p>
        Coins are a non-monetary in-service currency used to unlock paid features such as AI
        Coach analyses. Coins have no real-world cash value, are non-transferable between
        accounts, and cannot be exchanged for cash or any other consideration except as expressly
        stated in this Policy.
      </p>

      <h2>2. Eligibility for Refund</h2>
      <p>You may request a refund of a Coin purchase in the following cases:</p>
      <ul>
        <li>
          <strong>Cooling-off period.</strong> Within fourteen (14) calendar days of purchase,
          provided that none of the purchased Coins have been spent. Once any portion of a Coin
          pack has been consumed within the Service, the pack is considered &ldquo;used&rdquo;
          and is no longer refundable, as the digital good has been delivered and consumed.
        </li>
        <li>
          <strong>Technical fault.</strong> Coins were debited from your account but the paid
          feature failed to deliver due to a defect attributable to us (e.g. AI Coach analysis
          permanently failed to produce results). In such cases we will, at our discretion, either
          re-credit the spent Coins or refund their monetary value.
        </li>
        <li>
          <strong>Duplicate charge.</strong> You were charged more than once for the same
          purchase due to a payment processor error.
        </li>
        <li>
          <strong>Unauthorised charge.</strong> The purchase was made without your authorisation,
          subject to investigation.
        </li>
      </ul>

      <h2>3. Non-Refundable Cases</h2>
      <p>Refunds are not available in the following cases:</p>
      <ul>
        <li>Coins that have been fully or partially consumed within the Service;</li>
        <li>change of mind after consumption of the digital service;</li>
        <li>dissatisfaction with AI Coach output where the analysis was technically delivered;</li>
        <li>account termination due to breach of our <a href="/legal/terms">Terms of Service</a>;</li>
        <li>requests made more than 14 days after purchase, except where mandatory law provides otherwise.</li>
      </ul>

      <h2>4. How to Request a Refund</h2>
      <p>
        Send an email to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email
        address associated with your account, including:
      </p>
      <ul>
        <li>your account email and approximate date of purchase;</li>
        <li>the payment receipt or transaction identifier;</li>
        <li>a brief explanation of the reason for the refund request.</li>
      </ul>

      <h2>5. Processing Time</h2>
      <p>
        We aim to respond to refund requests within seven (7) business days. Approved refunds are
        returned to the original payment method. Settlement may take an additional 5&ndash;14
        business days depending on your bank or card issuer. Refunds are issued in Kazakhstani
        Tenge (KZT, ₸) at the original transaction amount; any currency conversion or bank
        commissions on your side are not within our control.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        Before initiating a chargeback with your bank or card issuer, we kindly ask that you
        contact us first so we can resolve the matter directly. Filing a chargeback without first
        contacting us may delay resolution and may result in suspension of your account pending
        investigation.
      </p>

      <h2>7. Consumer Rights</h2>
      <p>
        This Policy does not limit any mandatory rights granted to you as a consumer under the
        legislation of the {COUNTRY}. In case of any conflict between this Policy and mandatory
        consumer protection law, the latter prevails.
      </p>

      <h2>8. Contact</h2>
      <p>
        Refund requests and questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
