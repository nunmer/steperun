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
