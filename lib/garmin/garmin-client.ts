import { GarminAuth, type TokenStorage } from './garmin-auth';

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
