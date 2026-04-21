import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface MeteoData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  description: string;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class MeteoService {

  constructor(private http: HttpClient) {}

  getMeteo(lat: number, lng: number, date: string): Observable<MeteoData | null> {
    const dateOnly = date.split('T')[0]; // ← garder seulement YYYY-MM-DD
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,precipitation_probability_max&start_date=${dateOnly}&end_date=${dateOnly}&timezone=Africa%2FTunis`;

    return this.http.get<any>(url).pipe(
      map(res => {
        const daily = res.daily;
        if (!daily || !daily.temperature_2m_max?.length) return null;

        const code = daily.weathercode[0];
        return {
          temperature: Math.round((daily.temperature_2m_max[0] + daily.temperature_2m_min[0]) / 2),
          weatherCode: code,
          windSpeed: Math.round(daily.windspeed_10m_max[0]),
          humidity: daily.precipitation_probability_max[0] || 0,
          description: this.getDescription(code),
          icon: this.getIcon(code)
        };
      }),
      catchError(() => of(null))
    );
  }

  private getDescription(code: number): string {
    if (code === 0)           return 'Ciel dégagé';
    if (code <= 2)            return 'Partiellement nuageux';
    if (code === 3)           return 'Nuageux';
    if (code <= 49)           return 'Brouillard';
    if (code <= 59)           return 'Bruine';
    if (code <= 69)           return 'Pluie';
    if (code <= 79)           return 'Neige';
    if (code <= 82)           return 'Averses';
    if (code <= 99)           return 'Orage';
    return 'Inconnu';
  }

  private getIcon(code: number): string {
    if (code === 0)           return '☀️';
    if (code <= 2)            return '⛅';
    if (code === 3)           return '☁️';
    if (code <= 49)           return '🌫️';
    if (code <= 69)           return '🌧️';
    if (code <= 79)           return '❄️';
    if (code <= 82)           return '🌦️';
    if (code <= 99)           return '⛈️';
    return '🌡️';
  }
}