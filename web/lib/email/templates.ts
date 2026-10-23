import { DEFAULT_COPY, fill, type EmailCopy, type EmailKind } from "./copy";

/**
 * Transactional email templates in the site's "results sheet" style:
 * paper background, ink text, one bib-orange accent, a condensed uppercase
 * headline. Table layout and inline styles only, so they render in Gmail,
 * Outlook and Apple Mail. Every template also returns a plain-text version.
 * The words come from EmailCopy (lib/email/copy.ts), editable on /admin/emails.
 * Pure module: the admin editor previews and edits with it in the browser.
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

function paragraphs(text: string, vars: Record<string, string>, margin = "16px"): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 ${margin}">${block.split("\n").map((l) => inline(l, vars)).join("<br>")}</p>`)
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
// Formatters: how a copy field becomes HTML. "send" renders the final email;
// "edit" (admin editor) shows the raw text in place, editable, in the same layout.
// ---------------------------------------------------------------------------

interface Fmt {
  /** One line as HTML; `strong` styles **…**. */
  inline(key: string, strong?: string): string;
  /** Paragraphs as HTML; `margin` is the gap after each one. Empty → "". */
  block(key: string, margin?: string): string;
  /** One line without markup (kicker, button, note label). Empty → "". */
  line(key: string): string;
}

function sendFmt(copy: EmailCopy, vars: Record<string, string>): Fmt {
  return {
    inline: (key, strong) => inline(copy[key] ?? "", vars, strong),
    block: (key, margin) => paragraphs(copy[key] ?? "", vars, margin),
    line: (key) => esc(plain(copy[key] ?? "", vars)),
  };
}

/** A field the editor can type into; data-field names the EmailCopy key. */
function editable(key: string, text: string, block: boolean): string {
  return `<span data-field="${key}" contenteditable="plaintext-only" spellcheck="false" style="display:${block ? "block" : "inline-block"};min-width:3ch;min-height:1em;white-space:pre-wrap;outline:1px dashed ${C.rule};outline-offset:3px;cursor:text">${esc(text)}</span>`;
}

function editFmt(copy: EmailCopy): Fmt {
  return {
    inline: (key) => editable(key, copy[key] ?? "", false),
    block: (key, margin = "16px") => `<div style="margin:0 0 ${margin}">${editable(key, copy[key] ?? "", true)}</div>`,
    line: (key) => editable(key, copy[key] ?? "", false),
  };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface LayoutParts {
  /** Plain-text document title (the subject); never markup. */
  title: string;
  preheader: string;
  /** Already-escaped HTML from here on. */
  kicker: string;
  headline: string;
  body: string;
  footer: string;
  cta: { href: string; label: string };
}

function layout({ title, preheader, kicker, headline, body, footer, cta }: LayoutParts): string {
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
        ${kicker ? `<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.muted}">${kicker}</p>` : ""}
        <h1 style="margin:0 0 20px;font-family:${DISPLAY};font-size:34px;line-height:1.02;font-weight:700;text-transform:uppercase;color:${C.ink}">${headline}</h1>
      </td></tr>
      <tr><td style="font-family:${BODY};font-size:15px;line-height:1.6;color:${C.ink}">${body}</td></tr>
      <tr><td style="padding:8px 0 4px">
        <a href="${esc(cta.href)}" style="display:inline-block;background:${C.orange};color:#ffffff;font-family:${BODY};font-size:15px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:2px">${cta.label}</a>
      </td></tr>
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
      <span style="display:block;font-family:${MONO};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};margin-bottom:4px">${label}</span>
      ${esc(note)}
    </td></tr></table>`;
}

const ACCENT = `color:${C.orange}`;

type GreetingKey = "greeting" | "greetingNoName";

/** The shared frame of both claim emails around their own `body` paragraphs. */
function page(copy: EmailCopy, vars: Record<string, string>, f: Fmt, greetingKey: GreetingKey, body: string): string {
  return layout({
    title: plain(copy.subject, vars),
    preheader: plain(copy.preheader, vars),
    kicker: f.line("kicker"),
    headline: f.inline("headline", ACCENT),
    body: f.block(greetingKey) + body,
    footer: f.block("footer", "8px"),
    cta: { href: vars.profile_url, label: f.line("button") },
  });
}

function textVersion(copy: EmailCopy, vars: Record<string, string>, greetingKey: GreetingKey, body: string[]): string {
  return [
    plain(copy[greetingKey], vars),
    "",
    plain(copy.headline, vars),
    "",
    ...body,
    `${plain(copy.button, vars).replace(/\s*→$/, "")}: ${vars.profile_url}`,
    "",
    "Steppe RUN",
    plain(copy.footer, vars),
  ].join("\n");
}

export interface ClaimApprovedInput {
  firstName: string | null;
  runnerName: string;
  runnerId: number;
  /** Coins credited for this approval (claim bonus + race rewards). */
  coins: number;
}

function approvedVars({ firstName, runnerName, runnerId, coins }: ClaimApprovedInput): Record<string, string> {
  return {
    name: firstName ?? "",
    runner: runnerName,
    coins: String(coins),
    profile_url: `${SITE_URL}/profile`,
    runner_url: `${SITE_URL}/runners/${runnerId}`,
  };
}

function approvedHtml(copy: EmailCopy, vars: Record<string, string>, f: Fmt, greetingKey: GreetingKey, withCoins: boolean): string {
  return page(copy, vars, f, greetingKey, f.block("body") + (withCoins ? f.block("coinsLine") : ""));
}

export function claimApprovedEmail(input: ClaimApprovedInput, copy: EmailCopy = DEFAULT_COPY.approved): RenderedEmail {
  const vars = approvedVars(input);
  const greetingKey: GreetingKey = vars.name ? "greeting" : "greetingNoName";
  const withCoins = input.coins > 0 && !!copy.coinsLine.trim();
  return {
    subject: plain(copy.subject, vars),
    html: approvedHtml(copy, vars, sendFmt(copy, vars), greetingKey, withCoins),
    text: textVersion(copy, vars, greetingKey, [
      plain(copy.body, vars),
      "",
      ...(withCoins ? [plain(copy.coinsLine, vars), ""] : []),
    ]),
  };
}

export interface ClaimRejectedInput {
  firstName: string | null;
  runnerName: string;
  runnerId: number;
  /** Reviewer's note, shown verbatim when present. */
  notes: string | null;
}

function rejectedVars({ firstName, runnerName, runnerId }: ClaimRejectedInput): Record<string, string> {
  return {
    name: firstName ?? "",
    runner: runnerName,
    profile_url: `${SITE_URL}/profile`,
    runner_url: `${SITE_URL}/runners/${runnerId}`,
  };
}

function rejectedHtml(copy: EmailCopy, vars: Record<string, string>, f: Fmt, greetingKey: GreetingKey, note: string | undefined): string {
  const body = f.block("body") + (note ? noteBox(f.line("noteLabel"), note) : "") + f.block("afterNote");
  return page(copy, vars, f, greetingKey, body);
}

export function claimRejectedEmail(input: ClaimRejectedInput, copy: EmailCopy = DEFAULT_COPY.rejected): RenderedEmail {
  const vars = rejectedVars(input);
  const greetingKey: GreetingKey = vars.name ? "greeting" : "greetingNoName";
  const note = input.notes?.trim();
  return {
    subject: plain(copy.subject, vars),
    html: rejectedHtml(copy, vars, sendFmt(copy, vars), greetingKey, note),
    text: textVersion(copy, vars, greetingKey, [
      plain(copy.body, vars),
      "",
      ...(note ? [`${copy.noteLabel}: ${note}`, ""] : []),
      ...(copy.afterNote.trim() ? [plain(copy.afterNote, vars), ""] : []),
    ]),
  };
}

/** Sample data the editor shows around the editable text. */
export interface SampleInput {
  firstName: string;
  runnerName: string;
  runnerId: number;
  coins: number;
  notes: string;
}

/**
 * The email in the admin editor: same layout, but every field is its raw text
 * (placeholders and **markers** visible) in an element with data-field="<key>"
 * and contenteditable. Optional paragraphs are always shown so they can be filled.
 */
export function editableEmailHtml(kind: EmailKind, copy: EmailCopy, sample: SampleInput): string {
  const f = editFmt(copy);
  return kind === "approved"
    ? approvedHtml(copy, approvedVars(sample), f, "greeting", true)
    : rejectedHtml(copy, rejectedVars(sample), f, "greeting", sample.notes);
}
