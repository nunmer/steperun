import { DEFAULT_COPY, fill, type EmailCopy } from "./copy";

/**
 * Transactional email templates in the site's "results sheet" style:
 * paper background, ink text, one bib-orange accent, a condensed uppercase
 * headline. Table layout and inline styles only, so they render in Gmail,
 * Outlook and Apple Mail. Every template also returns a plain-text version.
 * The words come from EmailCopy (lib/email/copy.ts), editable on /admin/emails.
 * Pure module: the admin editor previews with it in the browser.
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

// ---------------------------------------------------------------------------
// The small text format of EmailCopy: **bold**, [text](url), bare URLs, paragraphs
// ---------------------------------------------------------------------------

const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;

/** One line of copy as HTML; `strong` styles **…** (orange in the headline). */
function inline(text: string, vars: Record<string, string>, strong = "font-weight:600"): string {
  return esc(fill(text, vars))
    .replace(LINK, (_m, label: string | undefined, href: string | undefined, bare: string | undefined) => {
      const url = href ?? bare ?? "";
      const shown = label ?? url.replace(/^https?:\/\//, "");
      return `<a href="${url}" style="color:${C.ink}">${shown}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, `<strong style="${strong}">$1</strong>`);
}

function paragraphs(text: string, vars: Record<string, string>): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px">${block.split("\n").map((l) => inline(l, vars)).join("<br>")}</p>`)
    .join("");
}

/** The same copy as plain text: links become "text (url)", markers dropped. */
function plain(text: string, vars: Record<string, string>): string {
  return fill(text, vars)
    .replace(LINK, (_m, label: string | undefined, href: string | undefined, bare: string | undefined) =>
      label ? `${label} (${href})` : bare ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface LayoutParts {
  /** Plain-text document title (the subject); never markup. */
  title: string;
  preheader: string;
  kicker: string;
  /** Already-escaped HTML. */
  headline: string;
  body: string;
  footer: string;
  cta?: { href: string; label: string };
}

function layout({ title, preheader, kicker, headline, body, footer, cta }: LayoutParts): string {
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
        ${kicker ? `<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.muted}">${esc(kicker)}</p>` : ""}
        <h1 style="margin:0 0 20px;font-family:${DISPLAY};font-size:34px;line-height:1.02;font-weight:700;text-transform:uppercase;color:${C.ink}">${headline}</h1>
      </td></tr>
      <tr><td style="font-family:${BODY};font-size:15px;line-height:1.6;color:${C.ink}">${body}</td></tr>
      ${button}
      <tr><td style="padding:32px 0 0;border-bottom:1px solid ${C.rule}"></td></tr>
      <tr><td style="padding:14px 0 0;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.muted}">${footer}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function noteBox(label: string, note: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>
    <td style="border-left:3px solid ${C.orange};background:${C.card};padding:12px 14px;font-family:${BODY};font-size:14px;line-height:1.5;color:${C.ink}">
      <span style="display:block;font-family:${MONO};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};margin-bottom:4px">${esc(label)}</span>
      ${esc(note)}
    </td></tr></table>`;
}

const ACCENT = `color:${C.orange}`;

/** Shared parts of both claim emails. */
function render(copy: EmailCopy, vars: Record<string, string>, body: { html: string; text: string[] }, ctaHref: string): RenderedEmail {
  const greeting = vars.name ? copy.greeting : copy.greetingNoName;
  const subject = plain(copy.subject, vars);
  const html = layout({
    title: subject,
    preheader: plain(copy.preheader, vars),
    kicker: plain(copy.kicker, vars),
    headline: inline(copy.headline, vars, ACCENT),
    body: (greeting.trim() ? paragraphs(greeting, vars) : "") + body.html,
    footer: paragraphs(copy.footer, vars).replace(/margin:0 0 16px/g, "margin:0 0 8px"),
    cta: { href: ctaHref, label: plain(copy.button, vars) },
  });
  const text = [
    plain(greeting, vars),
    "",
    plain(copy.headline, vars),
    "",
    ...body.text,
    `${plain(copy.button, vars).replace(/\s*→$/, "")}: ${ctaHref}`,
    "",
    "Steppe RUN",
    plain(copy.footer, vars),
  ].join("\n");
  return { subject, html, text };
}

export interface ClaimApprovedInput {
  firstName: string | null;
  runnerName: string;
  runnerId: number;
  /** Coins credited for this approval (claim bonus + race rewards). */
  coins: number;
}

export function claimApprovedEmail(
  { firstName, runnerName, runnerId, coins }: ClaimApprovedInput,
  copy: EmailCopy = DEFAULT_COPY.approved,
): RenderedEmail {
  const vars = {
    name: firstName ?? "",
    runner: runnerName,
    coins: String(coins),
    profile_url: `${SITE_URL}/profile`,
    runner_url: `${SITE_URL}/runners/${runnerId}`,
  };
  const withCoins = coins > 0 && copy.coinsLine.trim();
  return render(copy, vars, {
    html: paragraphs(copy.body, vars) + (withCoins ? paragraphs(copy.coinsLine, vars) : ""),
    text: [plain(copy.body, vars), "", ...(withCoins ? [plain(copy.coinsLine, vars), ""] : [])],
  }, vars.profile_url);
}

export interface ClaimRejectedInput {
  firstName: string | null;
  runnerName: string;
  runnerId: number;
  /** Reviewer's note, shown verbatim when present. */
  notes: string | null;
}

export function claimRejectedEmail(
  { firstName, runnerName, runnerId, notes }: ClaimRejectedInput,
  copy: EmailCopy = DEFAULT_COPY.rejected,
): RenderedEmail {
  const vars = {
    name: firstName ?? "",
    runner: runnerName,
    profile_url: `${SITE_URL}/profile`,
    runner_url: `${SITE_URL}/runners/${runnerId}`,
  };
  const note = notes?.trim();
  return render(copy, vars, {
    html: paragraphs(copy.body, vars) + (note ? noteBox(copy.noteLabel, note) : "") + paragraphs(copy.afterNote, vars),
    text: [
      plain(copy.body, vars),
      "",
      ...(note ? [`${copy.noteLabel}: ${note}`, ""] : []),
      ...(copy.afterNote.trim() ? [plain(copy.afterNote, vars), ""] : []),
    ],
  }, vars.profile_url);
}
