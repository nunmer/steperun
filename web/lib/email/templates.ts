/**
 * Transactional email templates in the site's "results sheet" style:
 * paper background, ink text, one bib-orange accent, a condensed uppercase
 * headline. Table layout and inline styles only, so they render in Gmail,
 * Outlook and Apple Mail. Every template also returns a plain-text version.
 */

export const SITE_URL = "https://www.steppe.run";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const C = {
  paper: "#f6f3ec",
  card: "#fbfaf6",
  ink: "#2b2620",
  muted: "#6f675d",
  rule: "#d9d3c7",
  orange: "#c4501f",
};
const DISPLAY = "'Arial Narrow','Helvetica Neue Condensed','Roboto Condensed',Arial,sans-serif";
const BODY = "'IBM Plex Sans','Helvetica Neue',Arial,sans-serif";
const MONO = "'IBM Plex Mono',Menlo,Consolas,monospace";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface LayoutParts {
  /** Plain-text document title (the subject); never markup. */
  title: string;
  preheader: string;
  kicker: string;
  headline: string;
  /** Already-escaped HTML paragraphs. */
  body: string;
  cta?: { href: string; label: string };
}

function layout({ title, preheader, kicker, headline, body, cta }: LayoutParts): string {
  const button = cta
    ? `<tr><td style="padding:8px 0 4px">
         <a href="${esc(cta.href)}" style="display:inline-block;background:${C.orange};color:#ffffff;font-family:${BODY};font-size:15px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:2px">${esc(cta.label)}</a>
       </td></tr>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
      <tr><td style="padding:0 0 14px;border-bottom:2px solid ${C.ink}">
        <span style="font-family:${DISPLAY};font-size:22px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${C.ink}">Steppe <span style="color:${C.orange}">RUN</span></span>
      </td></tr>
      <tr><td style="padding:28px 0 0">
        <p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.muted}">${esc(kicker)}</p>
        <h1 style="margin:0 0 20px;font-family:${DISPLAY};font-size:34px;line-height:1.02;font-weight:700;text-transform:uppercase;color:${C.ink}">${headline}</h1>
      </td></tr>
      <tr><td style="font-family:${BODY};font-size:15px;line-height:1.6;color:${C.ink}">${body}</td></tr>
      ${button}
      <tr><td style="padding:32px 0 0;border-bottom:1px solid ${C.rule}"></td></tr>
      <tr><td style="padding:14px 0 0;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.muted}">
        You are receiving this because you claimed a runner profile on
        <a href="${SITE_URL}" style="color:${C.muted}">steppe.run</a>. Questions? Just reply to this email.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const p = (html: string) => `<p style="margin:0 0 16px">${html}</p>`;

export interface ClaimApprovedInput {
  firstName: string | null;
  runnerName: string;
  runnerId: number;
  /** Coins credited for this approval (claim bonus + race rewards). */
  coins: number;
}

export function claimApprovedEmail({ firstName, runnerName, runnerId, coins }: ClaimApprovedInput): RenderedEmail {
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  const profileUrl = `${SITE_URL}/profile`;
  const publicUrl = `${SITE_URL}/runners/${runnerId}`;
  const coinLine = coins > 0
    ? `We've added <strong style="color:${C.orange}">${coins} coins</strong> to your balance for the claim and your races. You can spend them on AI Coach form analyses.`
    : "";

  const subject = `Your Steppe RUN profile is confirmed: ${runnerName}`;
  const html = layout({
    title: subject,
    preheader: `${runnerName} is now linked to your account.`,
    kicker: "Profile claim · approved",
    headline: `${esc(runnerName)} is <span style="color:${C.orange}">yours.</span>`,
    body:
      p(esc(hi)) +
      p(`We've confirmed your claim. Your results, personal bests and power score now live in your profile, and new races will appear there automatically.`) +
      (coinLine ? p(coinLine) : "") +
      p(`Your public page: <a href="${publicUrl}" style="color:${C.ink}">${esc(publicUrl.replace("https://", ""))}</a>`),
    cta: { href: profileUrl, label: "Open my profile →" },
  });

  const text = [
    hi,
    "",
    `${runnerName} is yours. We've confirmed your claim. Your results, personal bests and power score now live in your profile, and new races will appear there automatically.`,
    coins > 0 ? `\nWe've added ${coins} coins to your balance for the claim and your races. You can spend them on AI Coach form analyses.` : "",
    "",
    `Open your profile: ${profileUrl}`,
    `Your public page: ${publicUrl}`,
    "",
    "— Steppe RUN",
    "You are receiving this because you claimed a runner profile on steppe.run. Questions? Just reply to this email.",
  ].join("\n");

  return { subject, html, text };
}

export interface ClaimRejectedInput {
  firstName: string | null;
  runnerName: string;
  runnerId: number;
  /** Reviewer's note, shown verbatim when present. */
  notes: string | null;
}

export function claimRejectedEmail({ firstName, runnerName, runnerId, notes }: ClaimRejectedInput): RenderedEmail {
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  const runnerUrl = `${SITE_URL}/runners/${runnerId}`;
  const note = notes?.trim();

  const subject = `About your Steppe RUN claim: ${runnerName}`;
  const html = layout({
    title: subject,
    preheader: `We couldn't confirm your claim for ${runnerName}.`,
    kicker: "Profile claim · not approved",
    headline: `We couldn't confirm<br>this claim`,
    body:
      p(esc(hi)) +
      p(`We reviewed your claim for <a href="${runnerUrl}" style="color:${C.ink}"><strong>${esc(runnerName)}</strong></a> and couldn't confirm that this profile is yours.`) +
      (note
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>
             <td style="border-left:3px solid ${C.orange};background:${C.card};padding:12px 14px;font-family:${BODY};font-size:14px;line-height:1.5;color:${C.ink}">
               <span style="display:block;font-family:${MONO};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};margin-bottom:4px">Reviewer's note</span>
               ${esc(note)}
             </td></tr></table>`
        : "") +
      p(`If it is you, reply to this email with anything that shows it: a race photo with your bib, a registration confirmation, or a link to your Strava. Connecting Strava in your profile also helps us match you automatically.`),
    cta: { href: `${SITE_URL}/profile`, label: "Go to my profile" },
  });

  const text = [
    hi,
    "",
    `We reviewed your claim for ${runnerName} (${runnerUrl}) and couldn't confirm that this profile is yours.`,
    note ? `\nReviewer's note: ${note}` : "",
    "",
    "If it is you, reply to this email with anything that shows it: a race photo with your bib, a registration confirmation, or a link to your Strava. Connecting Strava in your profile also helps us match you automatically.",
    "",
    `Your profile: ${SITE_URL}/profile`,
    "",
    "— Steppe RUN",
    "You are receiving this because you claimed a runner profile on steppe.run. Questions? Just reply to this email.",
  ].join("\n");

  return { subject, html, text };
}
