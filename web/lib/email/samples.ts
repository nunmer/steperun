import { claimApprovedEmail, claimRejectedEmail, type RenderedEmail } from "@/lib/email/templates";

export type SampleKind = "approved" | "rejected";

/** Example data for previews and admin test sends (no real runner involved). */
export function sampleEmail(kind: SampleKind, fullName?: string): RenderedEmail {
  const firstName = fullName?.split(" ")[0] ?? "Aidana";
  return kind === "approved"
    ? claimApprovedEmail({ firstName, runnerName: "Sample Runner", runnerId: 1, coins: 70 })
    : claimRejectedEmail({
        firstName,
        runnerName: "Sample Runner",
        runnerId: 1,
        notes: "The finish times don't match the races on your Strava.",
      });
}
