import { claimApprovedEmail, claimRejectedEmail, type RenderedEmail, type SampleInput } from "@/lib/email/templates";
import type { EmailCopy, EmailKind } from "@/lib/email/copy";

export type SampleKind = EmailKind;

/** Example data for previews, the editor and admin test sends (no real runner involved). */
export function sampleInput(fullName?: string): SampleInput {
  return {
    firstName: fullName?.split(" ")[0] ?? "Aidana",
    runnerName: "Sample Runner",
    runnerId: 1,
    coins: 70,
    notes: "The finish times don't match the races on your Strava.",
  };
}

export function sampleEmail(kind: SampleKind, fullName?: string, copy?: EmailCopy): RenderedEmail {
  const input = sampleInput(fullName);
  return kind === "approved" ? claimApprovedEmail(input, copy) : claimRejectedEmail(input, copy);
}
