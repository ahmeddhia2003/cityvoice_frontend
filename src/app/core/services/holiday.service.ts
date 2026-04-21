import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

export type HolidayType = 'national' | 'eid_fitr' | 'eid_adha' | 'islamic';

export interface TunisianHoliday {
  type:     HolidayType;
  name:     string;           // Display name (French)
  nameAr:   string;           // Arabic name
  emoji:    string;
  color:    string;           // Banner gradient start
  colorEnd: string;           // Banner gradient end
  message:  string;           // Message contextuel affiché dans le bandeau
  /** Message opérationnel affiché sous le message principal (signalement différé) */
  opsMessage?: string;
  /** How many days before/after the holiday to show the banner */
  windowDays: number;
  /** Date du jour férié (YYYY-MM-DD) — remplie par l'API */
  date?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API : https://date.nager.at/api/v3/PublicHolidays/{year}/TN
// Gratuite, sans clé, maintenue par la communauté. Couvre les fériés fixes
// (Nouvel An, Indépendance, Fête du travail, République, Femme, Évacuation, …)
// + Aïd el-Fitr / Aïd el-Adha calculés sur le calendrier lunaire.
// ─────────────────────────────────────────────────────────────────────────────
const NAGER_URL = (year: number) =>
  `https://date.nager.at/api/v3/PublicHolidays/${year}/TN`;

interface NagerHoliday {
  date:        string;         // YYYY-MM-DD
  localName:   string;
  name:        string;
  countryCode: string;
  fixed:       boolean;
  global:      boolean;
  types:       string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping : tags API (mot-clé dans localName/name) → visuel (emoji, palette…)
// Si un jour férié ne matche aucun tag, on utilise le fallback "generic".
// ─────────────────────────────────────────────────────────────────────────────
interface HolidayVisual {
  type:     HolidayType;
  nameAr:   string;
  emoji:    string;
  color:    string;
  colorEnd: string;
  message:  string;
  windowDays: number;
}

const HOLIDAY_VISUALS: { match: (name: string) => boolean; visual: HolidayVisual }[] = [
  {
    match: n => /new year|nouvel an|jour de l'an|ras\s*al/i.test(n),
    visual: {
      type: 'national', nameAr: 'رأس السنة', emoji: '🎆',
      color: '#1A3A5C', colorEnd: '#0D6E8A',
      message: 'Bonne année ! Ensemble, bâtissons une ville meilleure.',
      windowDays: 1,
    },
  },
  {
    match: n => /independence|indépendance|independen/i.test(n),
    visual: {
      type: 'national', nameAr: 'عيد الاستقلال', emoji: '🇹🇳',
      color: '#CC0000', colorEnd: '#8B0000',
      message: 'Vive la Tunisie libre ! Signalez, participez, améliorons notre pays.',
      windowDays: 1,
    },
  },
  {
    match: n => /martyr/i.test(n),
    visual: {
      type: 'national', nameAr: 'يوم الشهداء', emoji: '🕊️',
      color: '#374151', colorEnd: '#1F2937',
      message: 'Hommage à ceux qui ont sacrifié leur vie pour la Tunisie.',
      windowDays: 0,
    },
  },
  {
    match: n => /labour|travail/i.test(n),
    visual: {
      type: 'national', nameAr: 'عيد الشغل', emoji: '⚒️',
      color: '#7C2D00', colorEnd: '#DC6803',
      message: 'Bonne fête du travail ! Ensemble pour une ville plus saine.',
      windowDays: 1,
    },
  },
  {
    match: n => /republic|république/i.test(n),
    visual: {
      type: 'national', nameAr: 'عيد الجمهورية', emoji: '🇹🇳',
      color: '#CC0000', colorEnd: '#8B0000',
      message: 'Bonne fête de la République ! La citoyenneté, c\'est aussi signaler.',
      windowDays: 1,
    },
  },
  {
    match: n => /women|femme/i.test(n),
    visual: {
      type: 'national', nameAr: 'يوم المرأة', emoji: '👩',
      color: '#7E22CE', colorEnd: '#A855F7',
      message: 'Bonne fête de la femme tunisienne ! Votre voix compte dans notre ville.',
      windowDays: 1,
    },
  },
  {
    match: n => /evacuation|évacuation|jalaa/i.test(n),
    visual: {
      type: 'national', nameAr: 'عيد الجلاء', emoji: '🌟',
      color: '#CC0000', colorEnd: '#8B0000',
      message: 'Vive la Tunisie souveraine !',
      windowDays: 1,
    },
  },
  {
    match: n => /eid al[- ]?fitr|aid al[- ]?fitr|aïd el[- ]?fitr|fitr/i.test(n),
    visual: {
      type: 'eid_fitr', nameAr: 'عيد الفطر', emoji: '🌙',
      color: '#064E3B', colorEnd: '#059669',
      message: 'عيد مبارك ! Joyeux Aïd el-Fitr à toute la communauté tunisienne.',
      windowDays: 2,
    },
  },
  {
    match: n => /eid al[- ]?adha|aid al[- ]?adha|aïd el[- ]?adha|adha|sacrifice/i.test(n),
    visual: {
      type: 'eid_adha', nameAr: 'عيد الأضحى', emoji: '🐑',
      color: '#78350F', colorEnd: '#D97706',
      message: 'عيد أضحى مبارك ! Joyeux Aïd el-Adha à vous et vos familles.',
      windowDays: 2,
    },
  },
  {
    match: n => /mawlid|mouled/i.test(n),
    visual: {
      type: 'islamic', nameAr: 'المولد النبوي', emoji: '🕌',
      color: '#065F46', colorEnd: '#10B981',
      message: 'Mawlid mubarak ! Bonne fête du Mouled.',
      windowDays: 1,
    },
  },
  {
    match: n => /hijri|islamic new year|ras al[- ]?sana/i.test(n),
    visual: {
      type: 'islamic', nameAr: 'رأس السنة الهجرية', emoji: '🌙',
      color: '#064E3B', colorEnd: '#047857',
      message: 'Bonne année hégirienne !',
      windowDays: 1,
    },
  },
];

// Fallback générique pour tout jour férié non reconnu
const FALLBACK_VISUAL: HolidayVisual = {
  type: 'national', nameAr: 'عطلة رسمية', emoji: '🎉',
  color: '#1F2937', colorEnd: '#374151',
  message: 'Jour férié en Tunisie — bonne journée à tous !',
  windowDays: 0,
};

// Message opérationnel identique pour tous les fériés : informe l'utilisateur
// que les signalements créés ce jour-là seront pris en charge à la reprise.
const OPS_MESSAGE =
  "📮 Les signalements créés aujourd'hui seront traités par les équipes dès la reprise du service.";

// ─────────────────────────────────────────────────────────────────────────────
// Fallback hardcodé — utilisé uniquement si l'API date.nager.at est injoignable.
// Ne couvre que l'année courante, à titre de sécurité.
// ─────────────────────────────────────────────────────────────────────────────
const HARDCODED_FALLBACK_2025_2028: { date: string; name: string }[] = [
  // Fériés fixes
  { date: '01-01', name: 'New Year\'s Day' },
  { date: '03-20', name: 'Independence Day' },
  { date: '04-09', name: 'Martyrs\' Day' },
  { date: '05-01', name: 'Labour Day' },
  { date: '07-25', name: 'Republic Day' },
  { date: '08-13', name: 'Women\'s Day' },
  { date: '10-15', name: 'Evacuation Day' },
  // Islamiques (approximations — l'API les recalcule correctement)
  { date: '2025-03-30', name: 'Eid al-Fitr' },
  { date: '2025-06-06', name: 'Eid al-Adha' },
  { date: '2026-03-20', name: 'Eid al-Fitr' },
  { date: '2026-05-26', name: 'Eid al-Adha' },
];

@Injectable({ providedIn: 'root' })
export class HolidayService {

  /** Cache mémoire : key = year, value = Observable des fériés */
  private yearCache = new Map<number, Observable<TunisianHoliday[]>>();

  constructor(private http: HttpClient) {}

  // ── API publique ──────────────────────────────────────────────────────────

  /**
   * Retourne un Observable du jour férié actif (dans sa fenêtre) — ou null.
   * Utilisé par le FestiveBannerComponent.
   */
  getTodayHoliday$(): Observable<TunisianHoliday | null> {
    // 1) Mode démo : ?demo=national | eid_fitr | eid_adha | mouled | independence …
    const demo = this._getDemoFromUrl();
    if (demo) return of(demo);

    const now   = new Date();
    const today = this._formatDate(now);

    return this._fetchYear(now.getFullYear()).pipe(
      map(list => {
        // Le plus proche dans la fenêtre
        for (const h of list) {
          if (!h.date) continue;
          const diff = Math.round(
            (now.getTime() - new Date(h.date).getTime()) / 86400000
          );
          if (diff >= -1 && diff <= h.windowDays) {
            return h;
          }
        }
        return null;
      }),
      catchError(() => of(null)),
    );
  }

  /**
   * Rétro-compat synchrone : renvoie immédiatement un jour férié démo si
   * présent dans l'URL, sinon null. Les composants doivent préférer
   * `getTodayHoliday$()`.
   */
  getTodayHoliday(): TunisianHoliday | null {
    return this._getDemoFromUrl();
  }

  /** True si la date donnée est un jour férié (utilisé côté scénarios SLA) */
  isHoliday$(date: Date): Observable<boolean> {
    return this._fetchYear(date.getFullYear()).pipe(
      map(list => list.some(h => h.date === this._formatDate(date))),
      catchError(() => of(false)),
    );
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _fetchYear(year: number): Observable<TunisianHoliday[]> {
    const cached = this.yearCache.get(year);
    if (cached) return cached;

    const obs = this.http.get<NagerHoliday[]>(NAGER_URL(year)).pipe(
      map(res => res.map(n => this._enrich(n))),
      catchError(err => {
        console.warn('[HolidayService] API date.nager.at KO, fallback local.', err);
        return of(this._fallbackForYear(year));
      }),
      shareReplay(1),
    );
    this.yearCache.set(year, obs);
    return obs;
  }

  private _enrich(api: NagerHoliday): TunisianHoliday {
    const visual = this._pickVisual(api.localName || api.name);
    return {
      ...visual,
      name:       api.localName || api.name,
      message:    visual.message,
      opsMessage: OPS_MESSAGE,
      date:       api.date,
    };
  }

  private _pickVisual(label: string): HolidayVisual {
    for (const v of HOLIDAY_VISUALS) {
      if (v.match(label)) return v.visual;
    }
    return FALLBACK_VISUAL;
  }

  private _formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private _fallbackForYear(year: number): TunisianHoliday[] {
    return HARDCODED_FALLBACK_2025_2028
      .filter(f => f.date.length === 5 || f.date.startsWith(`${year}-`))
      .map(f => {
        const visual = this._pickVisual(f.name);
        const date   = f.date.length === 5 ? `${year}-${f.date}` : f.date;
        return {
          ...visual,
          name:       f.name,
          message:    visual.message,
          opsMessage: OPS_MESSAGE,
          date,
        };
      });
  }

  // ── Mode démo : ?demo=national|eid_fitr|eid_adha|mouled|independence|… ────
  private _getDemoFromUrl(): TunisianHoliday | null {
    const params = new URLSearchParams(window.location.search);
    // Deux formes acceptées : ?demo=eid_fitr  OU  ?holiday=eid_fitr
    const key = (params.get('demo') || params.get('holiday') || '').toLowerCase();
    if (!key || !DEMO_MAP[key]) return null;

    const preset = DEMO_MAP[key];
    return {
      ...preset,
      opsMessage: OPS_MESSAGE,
      date:       this._formatDate(new Date()),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets pour le mode démo (?demo=…). Ne dépend pas de l'API → animation
// testable à tout moment, comme le ?demo=rain du WeatherService.
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_MAP: Record<string, TunisianHoliday> = {
  national: {
    type: 'national', name: 'Fête nationale', nameAr: 'عيد وطني', emoji: '🇹🇳',
    color: '#CC0000', colorEnd: '#8B0000',
    message: 'Démo — jour férié national', windowDays: 1,
  },
  independence: {
    type: 'national', name: 'Fête de l\'Indépendance', nameAr: 'عيد الاستقلال', emoji: '🇹🇳',
    color: '#CC0000', colorEnd: '#8B0000',
    message: 'Vive la Tunisie libre ! Signalez, participez, améliorons notre pays.',
    windowDays: 1,
  },
  republic: {
    type: 'national', name: 'Fête de la République', nameAr: 'عيد الجمهورية', emoji: '🇹🇳',
    color: '#CC0000', colorEnd: '#8B0000',
    message: 'Bonne fête de la République !', windowDays: 1,
  },
  women: {
    type: 'national', name: 'Fête de la Femme', nameAr: 'يوم المرأة', emoji: '👩',
    color: '#7E22CE', colorEnd: '#A855F7',
    message: 'Bonne fête de la femme tunisienne !', windowDays: 1,
  },
  labour: {
    type: 'national', name: 'Fête du Travail', nameAr: 'عيد الشغل', emoji: '⚒️',
    color: '#7C2D00', colorEnd: '#DC6803',
    message: 'Bonne fête du travail !', windowDays: 1,
  },
  new_year: {
    type: 'national', name: 'Nouvel An', nameAr: 'رأس السنة', emoji: '🎆',
    color: '#1A3A5C', colorEnd: '#0D6E8A',
    message: 'Bonne année !', windowDays: 1,
  },
  eid_fitr: {
    type: 'eid_fitr', name: 'Aïd el-Fitr', nameAr: 'عيد الفطر', emoji: '🌙',
    color: '#064E3B', colorEnd: '#059669',
    message: 'عيد مبارك ! Joyeux Aïd el-Fitr.', windowDays: 2,
  },
  eid_adha: {
    type: 'eid_adha', name: 'Aïd el-Adha', nameAr: 'عيد الأضحى', emoji: '🐑',
    color: '#78350F', colorEnd: '#D97706',
    message: 'عيد أضحى مبارك ! Joyeux Aïd el-Adha.', windowDays: 2,
  },
  mouled: {
    type: 'islamic', name: 'Mouled', nameAr: 'المولد النبوي', emoji: '🕌',
    color: '#065F46', colorEnd: '#10B981',
    message: 'Mawlid mubarak ! Bonne fête du Mouled.', windowDays: 1,
  },
  hijri: {
    type: 'islamic', name: 'Nouvel An hégirien', nameAr: 'رأس السنة الهجرية', emoji: '🌙',
    color: '#064E3B', colorEnd: '#047857',
    message: 'Bonne année hégirienne !', windowDays: 1,
  },
  // Alias générique
  holiday: {
    type: 'national', name: 'Jour férié', nameAr: 'عطلة رسمية', emoji: '🎉',
    color: '#1F2937', colorEnd: '#374151',
    message: 'Démo — jour férié en Tunisie.', windowDays: 0,
  },
};
