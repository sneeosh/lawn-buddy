// Weather data from Open-Meteo (no API key required).
// https://open-meteo.com/en/docs

import type { ClimateZone } from './zones';

export type WeatherForecast = {
  zoneId: string;
  fetchedAt: number;
  current: {
    temperatureF: number | null;
    soilTempF: number | null; // 0-7cm depth
  };
  daily: Array<{
    date: string; // YYYY-MM-DD
    highF: number | null;
    lowF: number | null;
    precipInches: number | null;
    precipProbabilityPct: number | null;
  }>;
};

export async function fetchWeatherForecast(zone: ClimateZone): Promise<WeatherForecast | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', zone.lat.toString());
  url.searchParams.set('longitude', zone.lon.toString());
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('current', 'temperature_2m');
  url.searchParams.set('hourly', 'soil_temperature_0_to_7cm');
  url.searchParams.set(
    'daily',
    [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
    ].join(',')
  );

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error('open-meteo error', res.status, await res.text());
    return null;
  }
  const data: any = await res.json();

  const dailyTimes: string[] = data?.daily?.time ?? [];
  const daily = dailyTimes.map((date, i) => ({
    date,
    highF: numAt(data?.daily?.temperature_2m_max, i),
    lowF: numAt(data?.daily?.temperature_2m_min, i),
    precipInches: numAt(data?.daily?.precipitation_sum, i),
    precipProbabilityPct: numAt(data?.daily?.precipitation_probability_max, i),
  }));

  // Use the next available hourly soil temp reading as "current" soil temp.
  const hourlySoil: number[] = data?.hourly?.soil_temperature_0_to_7cm ?? [];
  const soilTempF = hourlySoil.length ? hourlySoil[0] ?? null : null;

  return {
    zoneId: zone.id,
    fetchedAt: Math.floor(Date.now() / 1000),
    current: {
      temperatureF: typeof data?.current?.temperature_2m === 'number' ? data.current.temperature_2m : null,
      soilTempF,
    },
    daily,
  };
}

function numAt(arr: unknown, i: number): number | null {
  if (!Array.isArray(arr)) return null;
  const v = arr[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Compact human-readable summary for inclusion in the LLM prompt.
export function summarizeForecast(f: WeatherForecast): string {
  const lines: string[] = [];
  if (f.current.temperatureF !== null) {
    lines.push(`Current air temp: ${f.current.temperatureF.toFixed(0)}°F`);
  }
  if (f.current.soilTempF !== null) {
    lines.push(`Current soil temp (0–7cm): ${f.current.soilTempF.toFixed(0)}°F`);
  }
  lines.push('7-day forecast:');
  for (const d of f.daily) {
    const high = d.highF !== null ? `${d.highF.toFixed(0)}°` : '?';
    const low = d.lowF !== null ? `${d.lowF.toFixed(0)}°` : '?';
    const precip = d.precipInches !== null ? `${d.precipInches.toFixed(2)}"` : '0"';
    const prob = d.precipProbabilityPct !== null ? ` (${d.precipProbabilityPct}%)` : '';
    lines.push(`  ${d.date}: ${low}–${high}, precip ${precip}${prob}`);
  }
  return lines.join('\n');
}
