import { GarminAuth, type TokenStorage, type ConnectResult, type GarminMfaState } from './garmin-auth';

const GARMIN_CONNECT_API = 'https://connectapi.garmin.com';

const ENDPOINTS = {
  USER_SUMMARY: '/usersummary-service/usersummary/daily',
  HEART_RATE: '/wellness-service/wellness/dailyHeartRate',
  STEPS: '/wellness-service/wellness/dailySummaryChart',
  STRESS: '/wellness-service/wellness/dailyStress',
  BODY_BATTERY: '/wellness-service/wellness/bodyBattery/reports/daily',
  SLEEP: '/wellness-service/wellness/dailySleepData',
  HRV: '/hrv-service/hrv',
  ACTIVITIES: '/activitylist-service/activities/search/activities',
  TRAINING_READINESS: '/metrics-service/metrics/trainingReadiness',
  TRAINING_STATUS: '/metrics-service/metrics/trainingStatus/stats/latest',
  VO2MAX: '/metrics-service/metrics/maxmet/daily',
  RHR: '/metrics-service/metrics/restingHeartRate',
  WEEKLY_STEPS: '/usersummary-service/usersummary/weekly',
  BODY_COMPOSITION: '/weight-service/weight/dateRange',
  USER_PROFILE: '/userprofile-service/socialProfile',
};

export type DailySummary = {
  calendarDate: string;
  totalSteps: number;
  totalKilocalories: number;
  activeKilocalories: number;
  bmrKilocalories: number;
  wellnessKilocalories: number;
  floorsAscended: number;
  floorsDescended: number;
  minHeartRate: number;
  maxHeartRate: number;
  restingHeartRateValue: number;
  lastSevenDaysAvgRestingHeartRate: number;
  averageStressLevel: number;
  maxStressLevel: number;
  stressDuration: number;
  totalDistanceMeters: number;
  activeSeconds: number;
  sedentarySeconds: number;
  sleepingSeconds: number;
  moderateIntensityMinutes: number;
  vigorousIntensityMinutes: number;
  intensityMinutesGoal: number;
  bodyBatteryChargedValue: number;
  bodyBatteryDrainedValue: number;
  bodyBatteryHighestValue: number;
  bodyBatteryLowestValue: number;
  averageSpo2: number;
  averageMonitoringEnvironmentAltitude: number;
  highlyActiveSeconds: number;
};

export type SleepData = {
  dailySleepDTO: {
    calendarDate: string;
    sleepStartTimestampGMT: number;
    sleepEndTimestampGMT: number;
    sleepStartTimestampLocal: number;
    sleepEndTimestampLocal: number;
    unmeasurableSleepSeconds: number;
    deepSleepSeconds: number;
    lightSleepSeconds: number;
    remSleepSeconds: number;
    awakeSleepSeconds: number;
    averageSpO2Value: number;
    lowestSpO2Value: number;
    highestSpO2Value: number;
    averageRespirationValue: number;
    averageStressLevel: number;
    overallScore?: {
      value: number;
      qualifier: string;
    };
  };
};

export type HRVSummary = {
  hrvSummary: {
    calendarDate: string;
    weeklyAvg: number;
    lastNight: number;
    lastNight5MinHigh: number;
    baseline?: {
      lowUpper: number;
      balancedLow: number;
      balancedUpper: number;
    };
    status: string;
    feedbackPhrase: string;
  };
};

export type Activity = {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  startTimeGMT: string;
  activityType: { typeKey: string; typeId: number };
  distance: number;
  duration: number;
  averageSpeed: number;
  maxSpeed: number;
  calories: number;
  averageHR: number;
  maxHR: number;
  aerobicTrainingEffect: number;
  anaerobicTrainingEffect: number;
  averageRunningCadenceInStepsPerMinute: number;
  elevationGain: number;
  elevationLoss: number;
  locationName: string;
};

export type BodyBatteryReading = {
  date: string;
  charged: number;
  drained: number;
  highestValue: number;
  lowestValue: number;
};

export type TrainingReadiness = {
  calendarDate: string;
  score: number;
  scoreQualifier: string;
  acuteLoad: number;
  acuteLoadQualifier: string;
  recoveryTime: number;
  recoveryTimeQualifier: string;
  hrv7DayAverage: number;
  hrvQualifier: string;
  sleepScore: number;
  sleepQualifier: string;
};

export class GarminClient {
  private auth: GarminAuth;

  constructor(email: string, password: string, storage: TokenStorage) {
    this.auth = new GarminAuth(email, password, storage);
  }

  // Begin connecting. Resolves with { mfaRequired: true } + resumable state when
  // the account has 2FA enabled; otherwise completes auth and stores tokens.
  async connect(): Promise<ConnectResult> {
    return this.auth.connect();
  }

  // Finish a connect that paused for a 2FA code.
  async completeMfa(mfaState: GarminMfaState, code: string): Promise<void> {
    return this.auth.completeMfa(mfaState, code);
  }

  async getDailySummary(date: string): Promise<DailySummary> {
    const displayName = await this.getDisplayName();
    return this.auth.request<DailySummary>(
      `${ENDPOINTS.USER_SUMMARY}/${displayName}?calendarDate=${date}`,
    );
  }

  async getSleepData(date: string): Promise<SleepData> {
    const displayName = await this.getDisplayName();
    return this.auth.request<SleepData>(
      `${ENDPOINTS.SLEEP}/${displayName}?date=${date}&nonSleepBufferMinutes=60`,
    );
  }

  async getHRV(date: string): Promise<HRVSummary> {
    const displayName = await this.getDisplayName();
    return this.auth.request<HRVSummary>(
      `${ENDPOINTS.HRV}/${displayName}?startDate=${date}&endDate=${date}`,
    );
  }

  async getBodyBattery(startDate: string, endDate: string): Promise<BodyBatteryReading[]> {
    const raw = await this.auth.request<Array<{ date: string; charged: number; drained: number; highestValue: number; lowestValue: number }>>(
      `${ENDPOINTS.BODY_BATTERY}?startDate=${startDate}&endDate=${endDate}`,
    );
    return raw;
  }

  // The daily summary often returns null body-battery fields, so read the
  // dedicated body-battery endpoint and reduce its time-series to high/low and
  // the most recent (current) value. Each reading is typically
  // [timestampGMT, status, level, version]; level is index 2 (fallback index 1).
  async getBodyBatteryDay(date: string): Promise<{ high: number | null; low: number | null; current: number | null }> {
    try {
      const raw = await this.auth.request<Array<{ bodyBatteryValuesArray?: unknown[] }>>(
        `${ENDPOINTS.BODY_BATTERY}?startDate=${date}&endDate=${date}`,
      );
      const arr = raw?.[0]?.bodyBatteryValuesArray;
      if (!Array.isArray(arr) || arr.length === 0) return { high: null, low: null, current: null };

      const values: number[] = [];
      let current: number | null = null;
      let latestTs = -1;
      for (const entry of arr) {
        if (!Array.isArray(entry)) continue;
        const level = typeof entry[2] === 'number' ? entry[2]
          : typeof entry[1] === 'number' ? entry[1]
          : null;
        if (level == null || !Number.isFinite(level)) continue;
        values.push(level);
        const ts = typeof entry[0] === 'number' ? entry[0] : 0;
        if (ts >= latestTs) { latestTs = ts; current = level; }
      }
      if (values.length === 0) return { high: null, low: null, current: null };
      return { high: Math.max(...values), low: Math.min(...values), current };
    } catch {
      return { high: null, low: null, current: null };
    }
  }

  // VO2 max from the metrics endpoint. Shape varies; dig out the generic value.
  async getVo2Max(date: string): Promise<number | null> {
    try {
      const raw = await this.auth.request<unknown>(
        `${ENDPOINTS.VO2MAX}/${date}/${date}`,
      );
      const row = Array.isArray(raw) ? raw[0] : raw;
      const generic = (row as { generic?: { vo2MaxPreciseValue?: number; vo2MaxValue?: number } })?.generic;
      const v = generic?.vo2MaxPreciseValue ?? generic?.vo2MaxValue ?? null;
      return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
    } catch {
      return null;
    }
  }

  // Resting HR. The daily summary field is unreliable, so read the dedicated
  // daily heart-rate endpoint which carries restingHeartRate directly.
  async getRestingHeartRateDay(date: string): Promise<number | null> {
    try {
      const displayName = await this.getDisplayName();
      const raw = await this.auth.request<{ restingHeartRate?: number }>(
        `${ENDPOINTS.HEART_RATE}/${displayName}?date=${date}`,
      );
      const v = raw?.restingHeartRate;
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  async getActivities(limit = 20, start = 0): Promise<Activity[]> {
    return this.auth.request<Activity[]>(
      `${ENDPOINTS.ACTIVITIES}?limit=${limit}&start=${start}`,
    );
  }

  async getTrainingReadiness(date: string): Promise<TrainingReadiness[]> {
    return this.auth.request<TrainingReadiness[]>(
      `${ENDPOINTS.TRAINING_READINESS}/${date}`,
    );
  }

  async getRestingHeartRate(startDate: string, endDate: string): Promise<unknown> {
    const displayName = await this.getDisplayName();
    return this.auth.request(
      `${ENDPOINTS.RHR}/${displayName}?fromDate=${startDate}&untilDate=${endDate}`,
    );
  }

  async getWeeklySteps(startDate: string, endDate: string): Promise<unknown> {
    const displayName = await this.getDisplayName();
    return this.auth.request(
      `${ENDPOINTS.WEEKLY_STEPS}?calendarDate=${startDate}&profileId=${await this.getProfileId()}`,
    );
  }

  private async getDisplayName(): Promise<string> {
    // Request to trigger auth and populate displayName
    if (!this.auth.displayName) {
      await this.auth.request(`${GARMIN_CONNECT_API}${ENDPOINTS.USER_PROFILE}`);
    }
    return this.auth.displayName;
  }

  private async getProfileId(): Promise<number> {
    if (!this.auth.userProfilePk) {
      await this.auth.request(`${GARMIN_CONNECT_API}${ENDPOINTS.USER_PROFILE}`);
    }
    return this.auth.userProfilePk;
  }

  get tokens() {
    return this.auth.tokens;
  }
}
