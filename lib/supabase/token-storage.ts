import type { TokenStorage, StoredTokens } from '@/lib/garmin/garmin-auth';
import { createClient } from '@/lib/supabase/server';

export function createSupabaseTokenStorage(userId: string): TokenStorage {
  return {
    async load(): Promise<StoredTokens> {
      const supabase = await createClient();
      const { data } = await supabase
        .from('garmin_tokens')
        .select('oauth1_token, oauth2_token, garmin_profile')
        .eq('user_id', userId)
        .single();

      if (!data) {
        return { oauth1Token: null, oauth2Token: null, profile: null };
      }

      return {
        oauth1Token: data.oauth1_token as StoredTokens['oauth1Token'],
        oauth2Token: data.oauth2_token as StoredTokens['oauth2Token'],
        profile: data.garmin_profile as StoredTokens['profile'],
      };
    },

    async save(tokens: StoredTokens): Promise<void> {
      const supabase = await createClient();
      await supabase.from('garmin_tokens').upsert({
        user_id: userId,
        oauth1_token: tokens.oauth1Token,
        oauth2_token: tokens.oauth2Token,
        garmin_profile: tokens.profile,
        updated_at: new Date().toISOString(),
      });
    },
  };
}
