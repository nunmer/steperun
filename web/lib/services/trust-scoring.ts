/**
 * Trust scoring — pure functions, no I/O.
 */

export const TRUST_POINTS = {
  GOOGLE_LOGIN:        10,
  STRAVA_CONNECTED:    20,
  RACE_MATCH:          30,
  DATE_MATCH:          20,
  TRAINING_HISTORY:    10,
  MULTI_EVENT_BONUS:   10,
  GPX_UPLOADED:        20,
  SCREENSHOT_UPLOADED: 10,
  MANUAL_RESULT:       15,
  STRAVA_MISMATCH:     -5,
} as const;

export type ClaimDecision =
  | "auto_approved"
  | "needs_evidence"
  | "manual_review";

export interface TrustBreakdown {
  score: number;
  sources: string[];
}

export function computeTrustScore(breakdown: TrustBreakdown): number {
  return Math.min(100, Math.max(0, breakdown.score));
}

/**
 * Decide claim outcome for an unclaimed profile (first-come, lower bar).
 */
export function decideUnclaimedProfile(score: number): ClaimDecision {
  if (score >= 40) return "auto_approved";
  return "needs_evidence";
}

/**
 * Decide claim outcome when profile is already claimed by someone else.
 */
export function decideClaimedProfile(score: number): ClaimDecision {
  if (score >= 70) return "auto_approved";
  if (score >= 40) return "needs_evidence";
  return "manual_review";
}

/**
 * Decide dispute outcome.
 * Returns: "demote_owner" | "flag_admin" | "admin_required"
 */
export function decideDispute(
  ownerScore: number,
  claimantScore: number
): "demote_owner" | "flag_admin" | "admin_required" {
  if (ownerScore < 40 && claimantScore >= 70) return "demote_owner";
  if (claimantScore > ownerScore + 20) return "flag_admin";
  return "admin_required";
}

/**
 * Build initial trust breakdown for a new claim.
 * Caller supplies which signals are present.
 */
export function buildTrustBreakdown(signals: {
  hasGoogle: boolean;
  hasStrava: boolean;
  stravaMatchScore: number | null;      // points from strava matching (0 if no match)
  hasDateMatch: boolean;
  hasTrainingHistory: boolean;
  matchedEventsCount: number;
  hasGpx: boolean;
  hasScreenshot: boolean;
  hasManualResult: boolean;
  stravaActivityMismatch: boolean;
}): TrustBreakdown {
  let score = 0;
  const sources: string[] = [];

  if (signals.hasGoogle) {
    score += TRUST_POINTS.GOOGLE_LOGIN;
    sources.push("google_login");
  }
  if (signals.hasStrava) {
    score += TRUST_POINTS.STRAVA_CONNECTED;
    sources.push("strava_connected");
  }
  if (signals.stravaMatchScore !== null && signals.stravaMatchScore > 0) {
    score += TRUST_POINTS.RACE_MATCH;
    sources.push("race_match");
  }
  if (signals.hasDateMatch) {
    score += TRUST_POINTS.DATE_MATCH;
    sources.push("date_match");
  }
  if (signals.hasTrainingHistory) {
    score += TRUST_POINTS.TRAINING_HISTORY;
    sources.push("training_history");
  }
  if (signals.matchedEventsCount >= 2) {
    score += TRUST_POINTS.MULTI_EVENT_BONUS;
    sources.push("multi_event_bonus");
  }
  if (signals.hasGpx) {
    score += TRUST_POINTS.GPX_UPLOADED;
    sources.push("gpx_uploaded");
  }
  if (signals.hasScreenshot) {
    score += TRUST_POINTS.SCREENSHOT_UPLOADED;
    sources.push("screenshot_uploaded");
  }
  if (signals.hasManualResult) {
    score += TRUST_POINTS.MANUAL_RESULT;
    sources.push("manual_result");
  }
  if (signals.stravaActivityMismatch) {
    score += TRUST_POINTS.STRAVA_MISMATCH; // negative
    sources.push("strava_mismatch");
  }

  return { score, sources };
}
