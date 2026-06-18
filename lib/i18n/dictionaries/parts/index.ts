import type { Part } from './types';

// Per-area dictionary parts. Each area owns its own file to avoid edit
// conflicts; they are merged into the base dictionaries at load time.
import dashboard from './dashboard';
import activities from './activities';
import sleep from './sleep';
import group from './group';
import team from './team';
import coach from './coach';
import auth from './auth';
import onboarding from './onboarding';

export const PARTS: Part[] = [dashboard, activities, sleep, group, team, coach, auth, onboarding];
