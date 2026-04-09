import { createClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: number;
          slug: string;
          name: string;
          year: number | null;
          url: string;
          date_of_event: string | null;
          scraped_at: string | null;
          total_results: number;
        };
      };
      runners: {
        Row: {
          id: number;
          full_name: string;
          country: string | null;
          city: string | null;
          is_hidden: boolean;
          elo_score: number | null;
          elo_level: number | null;
          elo_updated_at: string | null;
          created_at: string;
          claimed_by: string | null;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          trust_score: number;
          verification_level: number;
          is_admin: boolean;
          coins: number;
          created_at: string;
          updated_at: string;
        };
      };
      coin_transactions: {
        Row: {
          id: number;
          user_id: string;
          amount: number;
          reason: string;
          ref_id: number | null;
          created_at: string;
        };
      };
      strava_tokens: {
        Row: {
          user_id: string;
          athlete_id: number;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string | null;
          connected_at: string;
          last_synced_at: string | null;
        };
      };
      runner_claims: {
        Row: {
          id: number;
          runner_id: number;
          user_id: string;
          status: "pending" | "approved" | "rejected" | "disputed" | "superseded";
          trust_score_at_claim: number;
          auto_approved: boolean;
          strava_match_score: number | null;
          strava_match_detail: unknown;
          evidence: unknown;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      disputes: {
        Row: {
          id: number;
          original_claim_id: number;
          disputing_user_id: string;
          status: "open" | "resolved_demoted" | "resolved_upheld" | "admin_decision";
          reason: string;
          evidence: unknown;
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      claim_audit_log: {
        Row: {
          id: number;
          event_type: string;
          user_id: string | null;
          runner_id: number | null;
          claim_id: number | null;
          ip_address: string | null;
          payload: unknown;
          created_at: string;
        };
      };
      run_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          status: "extracting" | "extracted" | "analyzing" | "done" | "error";
          frame_count: number;
          analysis: unknown;
          overall_score: number | null;
          provider: string;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          status?: string;
          provider?: string;
        };
        Update: {
          status?: string;
          frame_count?: number;
          analysis?: unknown;
          overall_score?: number;
          error?: string;
          updated_at?: string;
        };
      };
      run_frames: {
        Row: {
          id: string;
          session_id: string;
          idx: number;
          phase: string;
          frame_number: number;
          timestamp_ms: number;
          image_path: string;
          landmarks: unknown;
          created_at: string;
        };
        Insert: {
          session_id: string;
          idx: number;
          phase: string;
          frame_number: number;
          timestamp_ms: number;
          image_path: string;
          landmarks?: unknown;
        };
      };
      results: {
        Row: {
          id: number;
          runner_id: number;
          event_id: number;
          bib_number: string | null;
          distance_category: string | null;
          place: number | null;
          checkpoint_times: string[] | null;
          finish_time: string | null;
          chip_time: string | null;
          created_at: string;
        };
      };
    };
    Views: {
      v_results: {
        Row: {
          full_name: string;
          country: string | null;
          city: string | null;
          event_name: string;
          event_slug: string;
          year: number | null;
          distance_category: string | null;
          bib_number: string | null;
          place: number | null;
          finish_time: string | null;
          chip_time: string | null;
          checkpoint_times: string[] | null;
        };
      };
    };
    Functions: {
      get_distance_options: {
        Args: Record<string, never>;
        Returns: { distance_category: string }[];
      };
      get_event_categories: {
        Args: { p_slug: string };
        Returns: { distance_category: string }[];
      };
    };
  };
};

// Server-only — never exposed to the browser bundle
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
