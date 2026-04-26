// Minimal validators for intake + soil test payloads.
// Keep dependencies light — this is a personal project.

import { getZone } from './zones';

export type Intake = {
  size_sqft: number;
  sun_exposure: 'full' | 'partial' | 'shade';
  irrigation: 'none' | 'hose' | 'in_ground' | 'drip';
  mowing_frequency: 'weekly' | 'bi_weekly' | 'monthly' | 'irregular';
  current_issues: string[];
  notes?: string;
};

const SUN = ['full', 'partial', 'shade'] as const;
const IRRIGATION = ['none', 'hose', 'in_ground', 'drip'] as const;
const MOWING = ['weekly', 'bi_weekly', 'monthly', 'irregular'] as const;
const ISSUE_OPTIONS = [
  'bare_spots',
  'weeds',
  'discoloration',
  'thinning',
  'pests',
  'disease',
  'none',
];

export function validateIntake(value: unknown): Intake | string {
  if (typeof value !== 'object' || value === null) return 'intake must be an object';
  const v = value as Record<string, unknown>;

  const size = v.size_sqft;
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0)
    return 'size_sqft must be a positive number';

  const sun = v.sun_exposure;
  if (typeof sun !== 'string' || !SUN.includes(sun as (typeof SUN)[number]))
    return `sun_exposure must be one of: ${SUN.join(', ')}`;

  const irr = v.irrigation;
  if (typeof irr !== 'string' || !IRRIGATION.includes(irr as (typeof IRRIGATION)[number]))
    return `irrigation must be one of: ${IRRIGATION.join(', ')}`;

  const mow = v.mowing_frequency;
  if (typeof mow !== 'string' || !MOWING.includes(mow as (typeof MOWING)[number]))
    return `mowing_frequency must be one of: ${MOWING.join(', ')}`;

  const issues = v.current_issues;
  if (!Array.isArray(issues) || !issues.every((i) => typeof i === 'string' && ISSUE_OPTIONS.includes(i)))
    return `current_issues must be an array of: ${ISSUE_OPTIONS.join(', ')}`;

  const notes = v.notes;
  if (notes !== undefined && typeof notes !== 'string')
    return 'notes must be a string';

  return {
    size_sqft: size,
    sun_exposure: sun as Intake['sun_exposure'],
    irrigation: irr as Intake['irrigation'],
    mowing_frequency: mow as Intake['mowing_frequency'],
    current_issues: issues as string[],
    notes: typeof notes === 'string' ? notes : undefined,
  };
}

export type SoilTest = Partial<{
  ph: number;
  n: number;
  p: number;
  k: number;
  om_pct: number;
  cec: number;
  ca: number;
  mg: number;
  s: number;
  fe: number;
  mn: number;
  zn: number;
  cu: number;
  b: number;
}>;

const SOIL_FIELDS: (keyof SoilTest)[] = [
  'ph', 'n', 'p', 'k', 'om_pct', 'cec', 'ca', 'mg', 's', 'fe', 'mn', 'zn', 'cu', 'b',
];

export function validateSoilTest(value: unknown): SoilTest | string {
  if (typeof value !== 'object' || value === null) return 'soil_test must be an object';
  const v = value as Record<string, unknown>;
  const out: SoilTest = {};
  for (const k of SOIL_FIELDS) {
    if (v[k] === undefined || v[k] === null || v[k] === '') continue;
    const n = typeof v[k] === 'number' ? (v[k] as number) : Number(v[k]);
    if (!Number.isFinite(n)) return `soil_test.${k} must be a number`;
    out[k] = n;
  }
  return out;
}

export function validateClimateZone(id: unknown): string | null {
  if (typeof id !== 'string' || !getZone(id))
    return 'climate_zone must be a known zone id (see GET /api/zones)';
  return null;
}
