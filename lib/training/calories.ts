// MET-based calorie estimation for manually logged workouts.
//
// kcal = MET × weight(kg) × duration(hours)
//
// People without a wearable can't know calories burned, but we can give a
// realistic estimate from workout type, intensity and duration once we know
// their body weight. MET values follow the Compendium of Physical Activities
// (rounded, per-intensity). Estimates are intentionally approximate.

type Intensity = 'easy' | 'moderate' | 'hard';

// MET by workout type and intensity. Keys match the `type` values used in the
// training editor (see TYPE_META in CalendarClient).
const MET: Record<string, Record<Intensity, number>> = {
  run:      { easy: 7.0,  moderate: 9.8,  hard: 12.8 },
  cardio:   { easy: 5.0,  moderate: 7.0,  hard: 10.0 },
  strength: { easy: 3.5,  moderate: 5.0,  hard: 6.0 },
  mobility: { easy: 2.3,  moderate: 3.0,  hard: 4.0 },
  recovery: { easy: 2.5,  moderate: 3.0,  hard: 3.5 },
  rest:     { easy: 1.0,  moderate: 1.0,  hard: 1.0 },
  other:    { easy: 3.5,  moderate: 5.0,  hard: 7.0 },
};

const DEFAULT_INTENSITY: Intensity = 'moderate';
const FALLBACK_TYPE = 'other';

export function metFor(type: string | null | undefined, intensity: string | null | undefined): number {
  const t = (type && MET[type]) ? type : FALLBACK_TYPE;
  const i = (intensity === 'easy' || intensity === 'hard') ? intensity : DEFAULT_INTENSITY;
  return MET[t]![i];
}

/**
 * Estimate calories burned for a workout. Returns null when we lack the inputs
 * to make a meaningful estimate (no weight, or no/zero duration).
 */
export function estimateCalories(opts: {
  type?: string | null;
  intensity?: string | null;
  durationMin?: number | null;
  weightKg?: number | null;
}): number | null {
  const { type, intensity, durationMin, weightKg } = opts;
  if (!weightKg || weightKg <= 0) return null;
  if (!durationMin || durationMin <= 0) return null;
  const met = metFor(type, intensity);
  const kcal = met * weightKg * (durationMin / 60);
  return Math.round(kcal);
}
