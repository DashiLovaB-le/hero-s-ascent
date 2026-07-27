/**
 * Clima via Open-Meteo (sem API key) — server-only.
 * Geocoding + forecast com cache em memória (~45 min).
 */

export type WeatherSnapshot = {
  label: string;
  timezone: string | null;
  tempC: number | null;
  feelsLikeC: number | null;
  humidity: number | null;
  windKmh: number | null;
  precipitationMm: number | null;
  condition: string;
  todayMaxC: number | null;
  todayMinC: number | null;
  todayRainChance: number | null;
  tomorrowMaxC: number | null;
  tomorrowMinC: number | null;
  tomorrowCondition: string | null;
  fetchedAt: string;
};

type GeocodeHit = {
  label: string;
  lat: number;
  lon: number;
  timezone: string | null;
};

const CACHE_TTL_MS = 45 * 60_000;
const forecastCache = new Map<string, { at: number; data: WeatherSnapshot }>();

/** Códigos WMO (Open-Meteo) → português curto. */
function conditionFromWmo(code: number | null | undefined): string {
  if (code == null || Number.isNaN(code)) return "indisponível";
  if (code === 0) return "céu limpo";
  if (code === 1) return "principalmente limpo";
  if (code === 2) return "parcialmente nublado";
  if (code === 3) return "nublado";
  if (code === 45 || code === 48) return "neblina";
  if (code >= 51 && code <= 57) return "garoa";
  if (code >= 61 && code <= 67) return "chuva";
  if (code >= 71 && code <= 77) return "neve";
  if (code >= 80 && code <= 82) return "pancadas de chuva";
  if (code >= 85 && code <= 86) return "pancadas de neve";
  if (code === 95) return "trovoada";
  if (code === 96 || code === 99) return "trovoada com granizo";
  return "condição mista";
}

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function geocodeLocationQuery(query: string): Promise<GeocodeHit> {
  const q = query.trim();
  if (q.length < 2) throw new Error("Informe uma cidade com pelo menos 2 caracteres.");

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "pt");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error("Não foi possível localizar essa cidade agora. Tente de novo.");
  }

  const data = (await res.json()) as {
    results?: Array<{
      name?: string;
      latitude?: number;
      longitude?: number;
      admin1?: string;
      country?: string;
      country_code?: string;
      timezone?: string;
    }>;
  };

  const results = data.results ?? [];
  if (!results.length) {
    throw new Error("Cidade não encontrada. Tente outro nome (ex.: São Paulo).");
  }

  // Prefere Brasil se houver resultado BR na lista
  const preferred =
    results.find((r) => (r.country_code ?? "").toUpperCase() === "BR") ?? results[0];

  const lat = num(preferred.latitude);
  const lon = num(preferred.longitude);
  if (lat == null || lon == null) {
    throw new Error("Localização inválida retornada pelo geocoding.");
  }

  const parts = [preferred.name, preferred.admin1, preferred.country].filter(
    (p): p is string => Boolean(p && String(p).trim()),
  );
  const label = [...new Set(parts)].join(", ");

  return {
    label,
    lat,
    lon,
    timezone: preferred.timezone?.trim() || null,
  };
}

export async function fetchWeatherForCoords(opts: {
  lat: number;
  lon: number;
  label: string;
  timezone?: string | null;
}): Promise<WeatherSnapshot | null> {
  const key = cacheKey(opts.lat, opts.lon);
  const hit = forecastCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(opts.lat));
  url.searchParams.set("longitude", String(opts.lon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("timezone", opts.timezone?.trim() || "auto");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("wind_speed_unit", "kmh");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error("[weather] forecast HTTP", res.status);
      return hit?.data ?? null;
    }

    const data = (await res.json()) as {
      timezone?: string;
      current?: Record<string, unknown>;
      daily?: Record<string, unknown>;
    };

    const current = data.current ?? {};
    const daily = data.daily ?? {};
    const dailyCodes = Array.isArray(daily.weather_code) ? daily.weather_code : [];
    const dailyMax = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
    const dailyMin = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
    const dailyRain = Array.isArray(daily.precipitation_probability_max)
      ? daily.precipitation_probability_max
      : [];

    const snapshot: WeatherSnapshot = {
      label: opts.label,
      timezone: data.timezone ?? opts.timezone ?? null,
      tempC: num(current.temperature_2m),
      feelsLikeC: num(current.apparent_temperature),
      humidity: num(current.relative_humidity_2m),
      windKmh: num(current.wind_speed_10m),
      precipitationMm: num(current.precipitation),
      condition: conditionFromWmo(num(current.weather_code)),
      todayMaxC: num(dailyMax[0]),
      todayMinC: num(dailyMin[0]),
      todayRainChance: num(dailyRain[0]),
      tomorrowMaxC: num(dailyMax[1]),
      tomorrowMinC: num(dailyMin[1]),
      tomorrowCondition: conditionFromWmo(num(dailyCodes[1])),
      fetchedAt: new Date().toISOString(),
    };

    forecastCache.set(key, { at: Date.now(), data: snapshot });
    return snapshot;
  } catch (e) {
    console.error("[weather] forecast failed", e);
    return hit?.data ?? null;
  }
}

export function formatWeatherForMentor(w: WeatherSnapshot | null | undefined): string {
  if (!w) {
    return "Clima: região não cadastrada (herói pode definir a cidade no Perfil). Não invente o tempo.";
  }

  const nowBits = [
    w.tempC != null ? `${Math.round(w.tempC)}°C` : null,
    w.condition,
    w.feelsLikeC != null ? `sensação ${Math.round(w.feelsLikeC)}°C` : null,
    w.humidity != null ? `umidade ${Math.round(w.humidity)}%` : null,
    w.windKmh != null ? `vento ${Math.round(w.windKmh)} km/h` : null,
    w.precipitationMm != null && w.precipitationMm > 0
      ? `precipitação ${w.precipitationMm.toFixed(1)} mm`
      : null,
  ].filter(Boolean);

  const todayBits = [
    w.todayMaxC != null && w.todayMinC != null
      ? `máx ${Math.round(w.todayMaxC)}°C / mín ${Math.round(w.todayMinC)}°C`
      : null,
    w.todayRainChance != null ? `chance de chuva ${Math.round(w.todayRainChance)}%` : null,
  ].filter(Boolean);

  const tomorrowBits = [
    w.tomorrowCondition,
    w.tomorrowMaxC != null && w.tomorrowMinC != null
      ? `máx ${Math.round(w.tomorrowMaxC)}°C / mín ${Math.round(w.tomorrowMinC)}°C`
      : null,
  ].filter(Boolean);

  return [
    `Clima em ${w.label}${w.timezone ? ` (${w.timezone})` : ""}:`,
    `Agora: ${nowBits.join(", ") || "indisponível"}`,
    `Hoje: ${todayBits.join(", ") || "indisponível"}`,
    tomorrowBits.length ? `Amanhã: ${tomorrowBits.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
