import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import OAuth from 'oauth-1.0a';
import crypto from 'node:crypto';

const OAUTH_CONSUMER_URL = 'https://thegarth.s3.amazonaws.com/oauth_consumer.json';
const SSO_EMBED = 'https://sso.garmin.com/sso/embed';
const SSO_SIGNIN = 'https://sso.garmin.com/sso/signin';
const SSO_ORIGIN = 'https://sso.garmin.com';
const GARMIN_CONNECT_API = 'https://connectapi.garmin.com';
const OAUTH_PREAUTHORIZED = `${GARMIN_CONNECT_API}/oauth-service/oauth/preauthorized`;
const OAUTH_EXCHANGE = `${GARMIN_CONNECT_API}/oauth-service/oauth/exchange/user/2.0`;
const PROFILE_URL = `${GARMIN_CONNECT_API}/userprofile-service/socialProfile`;

const SSO_CLIENT_ID = 'GarminConnect';
const SSO_LOCALE = 'en';
const SSO_WIDGET_ID = 'gauth-widget';

const USER_AGENT_MOBILE = 'com.garmin.android.apps.connectmobile';
const USER_AGENT_BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CSRF_REGEX = /name="_csrf"\s+value="(.+?)"/;
const TICKET_REGEX = /ticket=([^"]+)"/;
const TITLE_REGEX = /<title>(.+?)<\/title>/;
const SSO_VERIFY_MFA = 'https://sso.garmin.com/sso/verifyMFA/loginEnterMfaCode';

const MAX_REQUEST_RETRIES = 3;
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

export type OAuth1Token = {
  oauth_token: string;
  oauth_token_secret: string;
};

export type OAuth2Token = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token_expires_in: number;
  refresh_token_expires_at: number;
};

type OAuthConsumer = {
  consumer_key: string;
  consumer_secret: string;
};

export type GarminUserProfile = {
  displayName: string;
  profileId: number;
};

export type StoredTokens = {
  oauth1Token: OAuth1Token | null;
  oauth2Token: OAuth2Token | null;
  profile: GarminUserProfile | null;
};

export type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

// Adapter so the auth class works with Supabase token storage instead of local filesystem
export interface TokenStorage {
  load(): Promise<StoredTokens>;
  save(tokens: StoredTokens): Promise<void>;
}

export class GarminAuth {
  private email: string;
  private password: string;
  private storage: TokenStorage;
  private consumer: OAuthConsumer | null = null;
  private oauth1Token: OAuth1Token | null = null;
  private oauth2Token: OAuth2Token | null = null;
  private profile: GarminUserProfile | null = null;
  private isAuthenticated = false;
  private loaded = false;

  get displayName(): string {
    return this.profile?.displayName ?? '';
  }

  get userProfilePk(): number {
    return this.profile?.profileId ?? 0;
  }

  get tokens(): StoredTokens {
    return {
      oauth1Token: this.oauth1Token,
      oauth2Token: this.oauth2Token,
      profile: this.profile,
    };
  }

  constructor(email: string, password: string, storage: TokenStorage) {
    this.email = email;
    this.password = password;
    this.storage = storage;
  }

  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    await this.ensureAuthenticated();

    const url = endpoint.startsWith('http') ? endpoint : `${GARMIN_CONNECT_API}${endpoint}`;
    const method = (options?.method ?? 'GET').toUpperCase();
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.oauth2Token!.access_token}`,
      'User-Agent': USER_AGENT_MOBILE,
      ...options?.headers,
    };

    if (options?.body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    for (let attempt = 0; attempt <= MAX_REQUEST_RETRIES; attempt++) {
      try {
        const response = await axios<T>({ url, method, headers: reqHeaders, data: options?.body });
        return response.data;
      } catch (error: unknown) {
        if (!axios.isAxiosError(error)) throw error;

        const status = error.response?.status;

        if (status === 401 && attempt === 0) {
          await this.refreshOrRelogin();
          reqHeaders.Authorization = `Bearer ${this.oauth2Token!.access_token}`;
          continue;
        }

        if ((status === 429 || (status && status >= 500)) && attempt < MAX_REQUEST_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.loaded) {
      const stored = await this.storage.load();
      this.oauth1Token = stored.oauth1Token;
      this.oauth2Token = stored.oauth2Token;
      this.profile = stored.profile;
      this.loaded = true;
    }

    if (this.isAuthenticated && this.oauth2Token && !this.isOAuth2Expired() && this.profile) return;

    if (this.oauth1Token && this.oauth2Token && !this.isOAuth2Expired() && this.profile) {
      this.isAuthenticated = true;
      return;
    }

    if (this.oauth1Token && this.oauth2Token && !this.isOAuth2Expired() && !this.profile) {
      await this.fetchProfile();
      await this.saveTokens();
      this.isAuthenticated = true;
      return;
    }

    if (this.oauth1Token) {
      await this.exchangeOAuth1ForOAuth2();
      await this.fetchProfile();
      await this.saveTokens();
      this.isAuthenticated = true;
      return;
    }

    await this.login();
    this.isAuthenticated = true;
  }

  private async refreshOrRelogin(): Promise<void> {
    this.isAuthenticated = false;

    if (this.oauth1Token) {
      try {
        await this.exchangeOAuth1ForOAuth2();
        if (!this.profile) await this.fetchProfile();
        await this.saveTokens();
        this.isAuthenticated = true;
        return;
      } catch {
        // fall through to re-login
      }
    }

    await this.login();
    this.isAuthenticated = true;
  }

  private async login(): Promise<void> {
    await this.fetchOAuthConsumer();
    const ticket = await this.getLoginTicket();
    await this.exchangeTicketForOAuth1(ticket);
    await this.exchangeOAuth1ForOAuth2();
    await this.fetchProfile();
    await this.saveTokens();
  }

  private async fetchProfile(): Promise<void> {
    const response = await axios.get<Record<string, unknown>>(PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${this.oauth2Token!.access_token}`,
        'User-Agent': USER_AGENT_MOBILE,
      },
    });

    const displayName = response.data.displayName as string;
    const profileId =
      (response.data.profileId as number) ?? (response.data.userProfileNumber as number);

    if (!displayName) throw new Error('Failed to get display name from profile');

    this.profile = { displayName, profileId };
  }

  private async fetchOAuthConsumer(): Promise<void> {
    if (this.consumer) return;
    const response = await axios.get<OAuthConsumer>(OAUTH_CONSUMER_URL);
    this.consumer = response.data;
  }

  private async getLoginTicket(): Promise<string> {
    const jar = new CookieJar();
    const ssoClient = wrapper(axios.create({ jar, withCredentials: true }));

    await ssoClient.get(SSO_EMBED, {
      params: { clientId: SSO_CLIENT_ID, locale: SSO_LOCALE, service: SSO_EMBED },
      headers: { 'User-Agent': USER_AGENT_BROWSER },
    });

    const signinParams = {
      id: SSO_WIDGET_ID,
      embedWidget: true,
      locale: SSO_LOCALE,
      gauthHost: SSO_EMBED,
    };

    const signinResponse = await ssoClient.get(SSO_SIGNIN, {
      params: signinParams,
      headers: { 'User-Agent': USER_AGENT_BROWSER },
    });

    const csrfMatch = CSRF_REGEX.exec(signinResponse.data);
    if (!csrfMatch) throw new Error('Failed to extract CSRF token from SSO');

    const loginResponse = await ssoClient.post(
      SSO_SIGNIN,
      new URLSearchParams({
        username: this.email,
        password: this.password,
        embed: 'true',
        _csrf: csrfMatch[1]!,
      }).toString(),
      {
        params: {
          ...signinParams,
          clientId: SSO_CLIENT_ID,
          service: SSO_EMBED,
          source: SSO_EMBED,
          redirectAfterAccountLoginUrl: SSO_EMBED,
          redirectAfterAccountCreationUrl: SSO_EMBED,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT_BROWSER,
          Origin: SSO_ORIGIN,
          Referer: SSO_SIGNIN,
          Dnt: '1',
        },
      },
    );

    let responseHtml: string = loginResponse.data;

    const titleMatch = TITLE_REGEX.exec(responseHtml);
    if (titleMatch?.[1]?.includes('MFA')) {
      const mfaCsrfMatch = CSRF_REGEX.exec(responseHtml);
      if (!mfaCsrfMatch) throw new Error('Failed to extract CSRF token for MFA');

      throw new Error(
        'MFA_REQUIRED: Your Garmin account has MFA enabled. Please disable MFA temporarily to connect, or contact support.',
      );
    }

    const ticketMatch = TICKET_REGEX.exec(responseHtml);
    if (!ticketMatch)
      throw new Error('LOGIN_FAILED: Invalid Garmin credentials. Please check and try again.');

    return ticketMatch[1]!;
  }

  private async exchangeTicketForOAuth1(ticket: string): Promise<void> {
    await this.fetchOAuthConsumer();

    const oauth = new OAuth({
      consumer: { key: this.consumer!.consumer_key, secret: this.consumer!.consumer_secret },
      signature_method: 'HMAC-SHA1',
      hash_function: (baseString, key) =>
        crypto.createHmac('sha1', key).update(baseString).digest('base64'),
    });

    const url = `${OAUTH_PREAUTHORIZED}?${new URLSearchParams({
      ticket,
      'login-url': SSO_EMBED,
      'accepts-mfa-tokens': 'true',
    })}`;

    const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'GET' }));

    const response = await axios.get(url, {
      headers: { ...authHeader, 'User-Agent': USER_AGENT_MOBILE },
    });

    const params = new URLSearchParams(response.data);
    const oauthToken = params.get('oauth_token');
    const oauthTokenSecret = params.get('oauth_token_secret');

    if (!oauthToken || !oauthTokenSecret) throw new Error('Failed to obtain OAuth1 token');

    this.oauth1Token = { oauth_token: oauthToken, oauth_token_secret: oauthTokenSecret };
  }

  private async exchangeOAuth1ForOAuth2(): Promise<void> {
    await this.fetchOAuthConsumer();
    if (!this.oauth1Token) throw new Error('OAuth1 token required for OAuth2 exchange');

    const oauth = new OAuth({
      consumer: { key: this.consumer!.consumer_key, secret: this.consumer!.consumer_secret },
      signature_method: 'HMAC-SHA1',
      hash_function: (baseString, key) =>
        crypto.createHmac('sha1', key).update(baseString).digest('base64'),
    });

    const token: OAuth.Token = {
      key: this.oauth1Token.oauth_token,
      secret: this.oauth1Token.oauth_token_secret,
    };

    const requestData = { url: OAUTH_EXCHANGE, method: 'POST' };
    const authData = oauth.authorize(requestData, token);

    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(authData)) {
      queryParams.set(key, String(value));
    }

    const response = await axios.post<OAuth2Token>(
      `${OAUTH_EXCHANGE}?${queryParams}`,
      null,
      {
        headers: {
          'User-Agent': USER_AGENT_MOBILE,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const now = Math.floor(Date.now() / 1000);
    this.oauth2Token = {
      ...response.data,
      expires_at: now + response.data.expires_in,
      refresh_token_expires_at: now + response.data.refresh_token_expires_in,
    };
  }

  private isOAuth2Expired(): boolean {
    if (!this.oauth2Token) return true;
    return this.oauth2Token.expires_at < Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_BUFFER_SECONDS;
  }

  private async saveTokens(): Promise<void> {
    await this.storage.save(this.tokens);
  }
}
