import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

export type WeatherLevel = 'storm' | 'rain' | 'fog' | 'wind' | 'heat' | null;

export interface WeatherAlert {
  level:          WeatherLevel;
  icon:           string;
  title:          string;
  message:        string;
  suggestedTypes: { code: string; label: string; emoji: string }[];
  color:          string;    // gradient start
  colorEnd:       string;    // gradient end
  weatherCode:    number;
  precipitation:  number;
  windSpeed:      number;
  temperature:    number;    // °C
  description:    string;    // ex: "Pluie modérée · 6 mm/h"
}

// ── WMO weather codes ──────────────────────────────────────────────────────
// 0-3  : Clair / Nuageux
// 45-48: Brouillard
// 51-67: Bruine / Pluie
// 71-77: Neige
// 80-82: Averses
// 95-99: Orage
function wmoToLevel(code: number, windKmh: number, tempC: number): WeatherLevel {
  if (code >= 95)              return 'storm';
  if (code >= 45 && code <= 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (windKmh > 50)            return 'wind';
  if (tempC >= 35)             return 'heat';
  return null;
}

function wmoDescription(code: number, precip: number): string {
  if (code === 0)  return 'Ciel dégagé';
  if (code <= 3)   return 'Partiellement nuageux';
  if (code <= 48)  return 'Brouillard';
  if (code <= 57)  return `Bruine · ${precip} mm/h`;
  if (code <= 67)  return `Pluie · ${precip} mm/h`;
  if (code <= 77)  return 'Chutes de neige';
  if (code <= 82)  return `Averses · ${precip} mm/h`;
  if (code <= 94)  return 'Grêle';
  return `Orage · ${precip} mm/h`;
}

// Codes alignés avec typeOptions du SignalerFormComponent :
// trou_chaussee | lampadaire_casse | poteau_endommage | fuite_eau
// dechets | signalisation | caniveau | autre
const ALERT_CONFIG: Record<NonNullable<WeatherLevel>, Omit<WeatherAlert, 'level'|'weatherCode'|'precipitation'|'windSpeed'|'temperature'|'description'>> = {
  storm: {
    icon:    '⛈️',
    title:   'Alerte orage en cours',
    message: 'Des orages sont signalés sur Tunis. Vérifiez votre environnement et signalez tout danger immédiat.',
    suggestedTypes: [
      { code: 'poteau_endommage', label: 'Poteau / câble tombé',   emoji: '⚡' },
      { code: 'caniveau',         label: 'Inondation / caniveau',  emoji: '🌊' },
      { code: 'signalisation',    label: 'Signalisation arrachée', emoji: '🚦' },
      { code: 'autre',            label: 'Arbre tombé',            emoji: '🌿' },
    ],
    color:    '#1E3A5F',
    colorEnd: '#4A1942',
  },
  rain: {
    icon:    '🌧️',
    title:   'Pluie en cours sur Tunis',
    message: "Il pleut actuellement. N'hésitez pas à signaler les problèmes aggravés par les précipitations.",
    suggestedTypes: [
      { code: 'caniveau',       label: 'Caniveau bouché',    emoji: '🌊' },
      { code: 'fuite_eau',      label: 'Fuite / écoulement', emoji: '💧' },
      { code: 'trou_chaussee',  label: 'Trou aggravé',       emoji: '🕳️' },
      { code: 'autre',          label: 'Glissement terrain', emoji: '🌿' },
    ],
    color:    '#1A3A5C',
    colorEnd: '#0D6E8A',
  },
  fog: {
    icon:    '🌫️',
    title:   'Visibilité réduite',
    message: 'Le brouillard réduit la visibilité. Signalez les problèmes de signalisation manquante ou illisible.',
    suggestedTypes: [
      { code: 'signalisation',    label: 'Signalisation absente', emoji: '🚦' },
      { code: 'lampadaire_casse', label: 'Éclairage défaillant',  emoji: '💡' },
    ],
    color:    '#374151',
    colorEnd: '#6B7280',
  },
  wind: {
    icon:    '💨',
    title:   'Vents forts signalés',
    message: 'Des vents violents soufflent sur la région. Signalez les dégâts causés par le vent.',
    suggestedTypes: [
      { code: 'poteau_endommage', label: 'Poteau / câble tombé',   emoji: '⚡' },
      { code: 'autre',            label: 'Arbre / branche tombée', emoji: '🌿' },
      { code: 'signalisation',    label: 'Panneau arraché',        emoji: '🚦' },
    ],
    color:    '#1F2937',
    colorEnd: '#374151',
  },
  heat: {
    icon:    '🌡️',
    title:   'Chaleur extrême — Alerte infrastructure',
    message: "Températures supérieures à 35 °C. La chaleur fragilise l'asphalte, les canalisations et l'éclairage. Signalez tout dysfonctionnement.",
    suggestedTypes: [
      { code: 'trou_chaussee',    label: 'Asphalte fondu / trou',  emoji: '🕳️' },
      { code: 'fuite_eau',        label: 'Fuite de canalisation',  emoji: '💧' },
      { code: 'lampadaire_casse', label: 'Éclairage surchauffé',   emoji: '💡' },
      { code: 'autre',            label: 'Banc / mobilier fondu',  emoji: '🪑' },
    ],
    color:    '#7C2D00',
    colorEnd: '#DC6803',
  },
};

@Injectable({ providedIn: 'root' })
export class WeatherService {

  // Fallback: Tunis centre coordinates
  private readonly DEFAULT_LAT = 36.8065;
  private readonly DEFAULT_LNG = 10.1815;

  // Cached user coordinates (5-min TTL)
  private geoCache: { lat: number; lng: number; ts: number } | null = null;
  private readonly GEO_TTL = 5 * 60 * 1000;

  // Cache 30 minutes
  private cache: { data: WeatherAlert | null; ts: number } | null = null;
  private readonly CACHE_MS = 30 * 60 * 1000;

  constructor(private http: HttpClient) {}

  /** Resolves to user coords if geolocation available, Tunis otherwise */
  private getCoords(): Observable<{ lat: number; lng: number }> {
    // Use cached geo if fresh
    if (this.geoCache && Date.now() - this.geoCache.ts < this.GEO_TTL) {
      return of({ lat: this.geoCache.lat, lng: this.geoCache.lng });
    }
    if (!navigator.geolocation) {
      return of({ lat: this.DEFAULT_LAT, lng: this.DEFAULT_LNG });
    }
    return from(
      new Promise<{ lat: number; lng: number }>(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            this.geoCache = { ...coords, ts: Date.now() };
            resolve(coords);
          },
          // Denied or error → fall back to Tunis
          () => resolve({ lat: this.DEFAULT_LAT, lng: this.DEFAULT_LNG }),
          { timeout: 5000, maximumAge: this.GEO_TTL }
        );
      })
    );
  }

  getAlert(): Observable<WeatherAlert | null> {

    // ── MODE DÉMO (?demo=rain | storm | fog | wind | heat) ───────────────────────
    // Permet de forcer un scénario météo pour une démonstration sans pluie réelle.
    // Usage : /signaler?demo=rain  ou  /?demo=heat
    const params = new URLSearchParams(window.location.search);
    const demoLevel = params.get('demo') as WeatherLevel;
    if (demoLevel && ALERT_CONFIG[demoLevel as NonNullable<WeatherLevel>]) {
      const alert: WeatherAlert = {
        level:         demoLevel,
        weatherCode:   demoLevel === 'storm' ? 95 : demoLevel === 'rain' ? 61 : demoLevel === 'fog' ? 45 : 0,
        precipitation: demoLevel === 'rain' ? 4.2 : demoLevel === 'storm' ? 12.5 : 0,
        windSpeed:     demoLevel === 'wind' ? 67 : 14.3,
        description:   demoLevel === 'storm' ? 'Orage · 12.5 mm/h'
                     : demoLevel === 'rain'  ? 'Pluie modérée · 4.2 mm/h'
                     : demoLevel === 'fog'   ? 'Brouillard dense'
                     : demoLevel === 'heat'  ? 'Chaleur extrême · 38.5 °C'
                     : 'Vents violents · 67 km/h',
        ...ALERT_CONFIG[demoLevel as NonNullable<WeatherLevel>],
        temperature:   demoLevel === 'heat' ? 38.5 : 28.0,
      };
      return of(alert);
    }

    // Return cache if still fresh
    if (this.cache && Date.now() - this.cache.ts < this.CACHE_MS) {
      return of(this.cache.data);
    }

    // Get user location first, then fetch weather for those coords
    return this.getCoords().pipe(
      switchMap(({ lat, lng }) => {
        const url = `https://api.open-meteo.com/v1/forecast`
          + `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`
          + `&current=weather_code,precipitation,wind_speed_10m,temperature_2m`
          + `&timezone=auto`;    // auto timezone by coords, not forced Tunis

        return this.http.get<any>(url).pipe(
          map(res => {
            const c    = res.current;
            const code = c.weather_code    as number;
            const prec = +(c.precipitation  ?? 0).toFixed(1);
            const wind = +(c.wind_speed_10m ?? 0).toFixed(1);
            const temp = +(c.temperature_2m ?? 0).toFixed(1);
            const level = wmoToLevel(code, wind, temp);

            if (!level) {
              this.cache = { data: null, ts: Date.now() };
              return null;
            }

            const alert: WeatherAlert = {
              level,
              weatherCode:   code,
              precipitation: prec,
              windSpeed:     wind,
              description:   level === 'heat'
                ? `Chaleur extrême · ${temp} °C`
                : wmoDescription(code, prec),
              ...ALERT_CONFIG[level],
              temperature:   temp,
            };

            this.cache = { data: alert, ts: Date.now() };
            return alert;
          }),
          catchError(() => of(null))
        );
      }),
      catchError(() => of(null))
    );
  }
}
