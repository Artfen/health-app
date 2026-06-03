export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          garmin_connected: boolean;
          garmin_display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          garmin_connected?: boolean;
          garmin_display_name?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          garmin_connected?: boolean;
          garmin_display_name?: string | null;
        };
      };
      garmin_tokens: {
        Row: {
          id: string;
          user_id: string;
          oauth1_token: Json | null;
          oauth2_token: Json | null;
          garmin_profile: Json | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          oauth1_token?: Json | null;
          oauth2_token?: Json | null;
          garmin_profile?: Json | null;
          updated_at?: string;
        };
        Update: {
          oauth1_token?: Json | null;
          oauth2_token?: Json | null;
          garmin_profile?: Json | null;
          updated_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          name: string;
          owner_id: string;
          invite_code?: string;
        };
        Update: {
          name?: string;
        };
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
        };
      };
      health_snapshots: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          steps: number | null;
          calories: number | null;
          active_calories: number | null;
          resting_hr: number | null;
          avg_stress: number | null;
          body_battery_high: number | null;
          body_battery_low: number | null;
          sleep_seconds: number | null;
          deep_sleep_seconds: number | null;
          rem_sleep_seconds: number | null;
          sleep_score: number | null;
          hrv_last_night: number | null;
          hrv_status: string | null;
          distance_meters: number | null;
          active_seconds: number | null;
          synced_at: string;
        };
        Insert: {
          user_id: string;
          date: string;
          steps?: number | null;
          calories?: number | null;
          active_calories?: number | null;
          resting_hr?: number | null;
          avg_stress?: number | null;
          body_battery_high?: number | null;
          body_battery_low?: number | null;
          sleep_seconds?: number | null;
          deep_sleep_seconds?: number | null;
          rem_sleep_seconds?: number | null;
          sleep_score?: number | null;
          hrv_last_night?: number | null;
          hrv_status?: string | null;
          distance_meters?: number | null;
          active_seconds?: number | null;
        };
        Update: {
          steps?: number | null;
          calories?: number | null;
          active_calories?: number | null;
          resting_hr?: number | null;
          avg_stress?: number | null;
          body_battery_high?: number | null;
          body_battery_low?: number | null;
          sleep_seconds?: number | null;
          deep_sleep_seconds?: number | null;
          rem_sleep_seconds?: number | null;
          sleep_score?: number | null;
          hrv_last_night?: number | null;
          hrv_status?: string | null;
          distance_meters?: number | null;
          active_seconds?: number | null;
        };
      };
    };
  };
};
