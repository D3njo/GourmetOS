import {
  getItem,
  setItem,
  STORAGE_KEYS,
  getWeatherMode,
  saveWeatherMode,
  getForecastCache,
  saveForecastCache,
  getPreferences,
  savePreferences
} from './storage.js';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const RAIN_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
const FORECAST_DAYS = 7;
const MANUAL_MODES = new Set(['hot', 'cold', 'mild']);

/** Default fallback when geolocation is unavailable (Berlin) */
const FALLBACK_COORDS = { latitude: 52.52, longitude: 13.405 };

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getManualWeatherMode() {
  const mode = getWeatherMode();
  return MANUAL_MODES.has(mode) ? mode : null;
}

/** Resolve hot / cold / mild from temperature and WMO weather code */
export function resolveWeatherTagFromValues(tempC, weathercode) {
  if (tempC == null || Number.isNaN(tempC)) return 'mild';
  const isRain = weathercode != null && RAIN_CODES.includes(weathercode);
  if (tempC >= 24 || (!isRain && tempC >= 20)) return 'hot';
  if (tempC <= 14 || isRain) return 'cold';
  return 'mild';
}

export function resolveWeatherTagFromDaily(daily) {
  const temp =
    daily.tempMean ??
    (daily.tempMax != null && daily.tempMin != null
      ? (daily.tempMax + daily.tempMin) / 2
      : daily.tempMax ?? daily.tempMin);
  return resolveWeatherTagFromValues(temp, daily.weathercode);
}

/** Resolved tag for auto mode from live + daily forecast */
export function resolveAutoWeatherTag(forecast, dateStr = null) {
  if (!forecast) return 'mild';

  if (dateStr) {
    const day = forecast.daily?.find((d) => d.date === dateStr);
    if (day) return resolveWeatherTagFromDaily(day);
  }

  const current = forecast.current;
  if (current?.temperature != null) {
    return resolveWeatherTagFromValues(current.temperature, current.weathercode);
  }

  const todayStr = toDateKey(new Date());
  const todayDay = forecast.daily?.find((d) => d.date === todayStr);
  if (todayDay) return resolveWeatherTagFromDaily(todayDay);

  return 'mild';
}

function parseForecastResponse(data) {
  if (!data?.current_weather || !data?.daily?.time?.length) {
    throw new Error('Invalid Open-Meteo response');
  }

  const current = data.current_weather;
  const daily = data.daily;

  const days = daily.time.map((dateStr, i) => ({
    date: dateStr,
    tempMax: daily.temperature_2m_max[i],
    tempMin: daily.temperature_2m_min[i],
    tempMean: (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2,
    weathercode: daily.weathercode[i],
    precipitation: daily.precipitation_sum?.[i] ?? 0
  }));

  return {
    current: {
      temperature: current.temperature,
      weathercode: current.weathercode,
      windspeed: current.windspeed,
      time: current.time
    },
    daily: days,
    fetchedAt: new Date().toISOString(),
    planningStart: toDateKey(new Date())
  };
}

export async function fetchWeeklyForecast(latitude, longitude) {
  const url =
    `${OPEN_METEO}?latitude=${latitude}&longitude=${longitude}` +
    `&current_weather=true` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum` +
    `&forecast_days=${FORECAST_DAYS}&timezone=auto`;

  let response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch (networkErr) {
    throw new Error(`Network error: ${networkErr.message}`);
  }

  if (!response.ok) {
    throw new Error(`Weather API HTTP ${response.status}`);
  }

  const payload = parseForecastResponse(await response.json());
  payload.coords = { latitude, longitude };

  setItem(STORAGE_KEYS.weatherCache, payload.current);
  saveForecastCache(payload);
  return payload;
}

export function getCachedForecast() {
  return getForecastCache();
}

function getSavedCoords() {
  const prefs = getPreferences();
  if (prefs.lastCoords?.latitude != null && prefs.lastCoords?.longitude != null) {
    return prefs.lastCoords;
  }
  return null;
}

function saveLastCoords(coords) {
  savePreferences({
    lastCoords: { latitude: coords.latitude, longitude: coords.longitude }
  });
}

function getPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 600000,
      ...options
    });
  });
}

/** Try geolocation; fall back to saved or default coordinates */
export async function resolveCoordinates() {
  try {
    const position = await getPosition();
    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      source: 'gps'
    };
    saveLastCoords(coords);
    return coords;
  } catch {
    const saved = getSavedCoords();
    if (saved) return { ...saved, source: 'saved' };

    return { ...FALLBACK_COORDS, source: 'fallback' };
  }
}

export function getCurrentWeekDates() {
  const today = startOfDay(new Date());
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const keys = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ];

  return keys.map((dayKey, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { dayKey, date, dateStr: toDateKey(date) };
  });
}

/**
 * Weather tag for a calendar day.
 * Manual modes override; auto uses forecast for that date.
 */
export function getWeatherTagForDate(dateStr, forecast, manualMode) {
  if (manualMode && MANUAL_MODES.has(manualMode)) return manualMode;

  const dayForecast = forecast?.daily?.find((d) => d.date === dateStr);
  if (dayForecast) return resolveWeatherTagFromDaily(dayForecast);

  return resolveAutoWeatherTag(forecast, dateStr);
}

export async function initWeatherEngine(onUpdate) {
  const manual = getManualWeatherMode();
  const cached = getCachedForecast();

  if (cached?.current) {
    onUpdate({
      forecast: cached,
      manual,
      fromCache: true,
      coordsSource: cached.coordsSource ?? (getSavedCoords() ? 'saved' : null)
    });
  }

  try {
    const coords = await resolveCoordinates();
    const forecast = await fetchWeeklyForecast(coords.latitude, coords.longitude);
    forecast.coordsSource = coords.source;
    onUpdate({ forecast, manual, error: false, coordsSource: coords.source });
  } catch (primaryErr) {
    if (cached?.current) {
      onUpdate({ forecast: cached, manual, error: false, stale: true });
      return;
    }

    try {
      const coords = getSavedCoords() || FALLBACK_COORDS;
      const forecast = await fetchWeeklyForecast(coords.latitude, coords.longitude);
      forecast.coordsSource = 'fallback';
      onUpdate({ forecast, manual, error: false, coordsSource: 'fallback' });
    } catch {
      onUpdate({ forecast: cached ?? null, manual, error: true });
    }
  }
}

export function setManualWeather(mode) {
  saveWeatherMode(mode);
}

export function clearManualWeather() {
  saveWeatherMode('auto');
}

export function weatherIcon(tag) {
  if (tag === 'hot') return '☀️';
  if (tag === 'cold') return '🌧️';
  return '⛅';
}

export async function refreshForecast() {
  const coords = await resolveCoordinates();
  const forecast = await fetchWeeklyForecast(coords.latitude, coords.longitude);
  forecast.coordsSource = coords.source;
  return forecast;
}
