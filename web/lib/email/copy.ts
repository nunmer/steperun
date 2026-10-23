/*
 * The editable words of the claim emails. Admins change them on /admin/emails
 * (stored in app_settings); the layout, colours and links stay in templates.ts.
 * Pure module: the admin editor renders its live preview with it in the browser.
 *
 * Text format in every field:
 *   {name} {runner} {coins} {profile_url} {runner_url}   filled in per email
 *   **words**          bold (in the headline: the orange accent)
 *   [text](https://…)  a link; a bare https:// URL is linked too
 *   a blank line       starts a new paragraph (multi-line fields)
 */

export type EmailKind = "approved" | "rejected";
export const EMAIL_KINDS: readonly EmailKind[] = ["approved", "rejected"];

export interface CopyField {
  key: string;
  label: string;
  help?: string;
  multiline?: boolean;
  required?: boolean;
  max: number;
}

const COMMON_HEAD: CopyField[] = [
  { key: "subject", label: "Subject", required: true, max: 150 },
  { key: "preheader", label: "Inbox preview line", help: "Shown after the subject in most inboxes.", max: 200 },
  { key: "kicker", label: "Small label above the headline", max: 80 },
  { key: "headline", label: "Headline", help: "**words** turn orange.", required: true, max: 120 },
  { key: "greeting", label: "Greeting", max: 80 },
  { key: "greetingNoName", label: "Greeting when the name is unknown", max: 80 },
];
const COMMON_TAIL: CopyField[] = [
  { key: "button", label: "Button", required: true, max: 40 },
  { key: "footer", label: "Footer", multiline: true, max: 400 },
];

export const COPY_FIELDS: Record<EmailKind, CopyField[]> = {
  approved: [
    ...COMMON_HEAD,
    { key: "body", label: "Message", multiline: true, required: true, max: 2000 },
    { key: "coinsLine", label: "Coins paragraph", help: "Only sent when coins were credited.", multiline: true, max: 400 },
    ...COMMON_TAIL,
  ],
  rejected: [
    ...COMMON_HEAD,
    { key: "body", label: "Message before the reviewer's note", multiline: true, required: true, max: 2000 },
    { key: "noteLabel", label: "Reviewer's note label", help: "The note box only appears when you wrote a reason.", max: 40 },
    { key: "afterNote", label: "Message after the note", multiline: true, max: 2000 },
    ...COMMON_TAIL,
  ],
};

/** Placeholders each email understands, with what they become. */
export const PLACEHOLDERS: Record<EmailKind, Record<string, string>> = {
  approved: {
    name: "claimant's first name",
    runner: "runner profile name",
    coins: "coins credited",
    profile_url: "link to /profile",
    runner_url: "link to the public runner page",
  },
  rejected: {
    name: "claimant's first name",
    runner: "runner profile name",
    profile_url: "link to /profile",
    runner_url: "link to the public runner page",
  },
};

export type EmailCopy = Record<string, string>;

const FOOTER = "You are receiving this because you claimed a runner profile on steppe.run. Questions? Just reply to this email.";

export const DEFAULT_COPY: Record<EmailKind, EmailCopy> = {
  approved: {
    subject: "Your Steppe RUN profile is confirmed: {runner}",
    preheader: "{runner} is now linked to your account.",
    kicker: "Profile claim · approved",
    headline: "{runner} is **yours.**",
    greeting: "Hi {name},",
    greetingNoName: "Hi,",
    body: "We've confirmed your claim. Your results, personal bests and power score now live in your profile, and new races will appear there automatically.\n\nYour public page: {runner_url}",
    coinsLine: "We've added **{coins} coins** to your balance for the claim and your races. You can spend them on AI Coach form analyses.",
    button: "Open my profile →",
    footer: FOOTER,
  },
  rejected: {
    subject: "About your Steppe RUN claim: {runner}",
    preheader: "We couldn't confirm your claim for {runner}.",
    kicker: "Profile claim · not approved",
    headline: "We couldn't confirm this claim",
    greeting: "Hi {name},",
    greetingNoName: "Hi,",
    body: "We reviewed your claim for [**{runner}**]({runner_url}) and couldn't confirm that this profile is yours.",
    noteLabel: "Reviewer's note",
    afterNote: "If it is you, reply to this email with anything that shows it: a race photo with your bib, a registration confirmation, or a link to your Strava. Connecting Strava in your profile also helps us match you automatically.",
    button: "Go to my profile",
    footer: FOOTER,
  },
};

/** Saved overrides on top of the defaults; unknown keys are dropped. */
export function withDefaults(kind: EmailKind, stored: unknown): EmailCopy {
  const copy = { ...DEFAULT_COPY[kind] };
  if (stored && typeof stored === "object") {
    for (const f of COPY_FIELDS[kind]) {
      const v = (stored as Record<string, unknown>)[f.key];
      if (typeof v === "string") copy[f.key] = v;
    }
  }
  return copy;
}

/** Why the copy can't be saved, or null. */
export function copyError(kind: EmailKind, copy: EmailCopy): string | null {
  for (const f of COPY_FIELDS[kind]) {
    const v = copy[f.key] ?? "";
    if (f.required && !v.trim()) return `${f.label} can't be empty.`;
    if (v.length > f.max) return `${f.label} is at most ${f.max} characters.`;
    if (!f.multiline && /[\r\n]/.test(v)) return `${f.label} must be one line.`;
  }
  const unknown = Object.values(copy).join(" ").match(/\{(\w+)\}/g)
    ?.map((m) => m.slice(1, -1))
    .find((name) => !(name in PLACEHOLDERS[kind]));
  return unknown ? `{${unknown}} isn't available in this email.` : null;
}

/** Replace {placeholders}; unknown ones are left as typed. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, name: string) => vars[name] ?? m);
}
