import { Injectable } from '@angular/core';

export type HolidayType = 'national' | 'eid_fitr' | 'eid_adha' | 'islamic';

export interface TunisianHoliday {
  type:    HolidayType;
  name:    string;           // Display name (French)
  nameAr:  string;           // Arabic name
  emoji:   string;
  color:   string;           // Banner gradient start
  colorEnd:string;           // Banner gradient end
  message: string;
  /** How many days before/after the holiday to show the banner (-1 = day before, 0 = day of, 1 = day after) */
  windowDays: number;
}

// ── Fixed national holidays (Gregorian) ────────────────────────────────────
const NATIONAL_HOLIDAYS: { month: number; day: number; holiday: TunisianHoliday }[] = [
  {
    month: 1, day: 1,
    holiday: {
      type: 'national', name: 'Nouvel An', nameAr: 'رأس السنة', emoji: '🎆',
      color: '#1A3A5C', colorEnd: '#0D6E8A',
      message: 'Bonne année ! Ensemble, bâtissons une ville meilleure pour 2025.',
      windowDays: 1,
    },
  },
  {
    month: 3, day: 20,
    holiday: {
      type: 'national', name: 'Fête de l\'Indépendance', nameAr: 'عيد الاستقلال', emoji: '🇹🇳',
      color: '#CC0000', colorEnd: '#8B0000',
      message: 'Vive la Tunisie libre ! Signalez, participez, améliorons notre pays.',
      windowDays: 1,
    },
  },
  {
    month: 4, day: 9,
    holiday: {
      type: 'national', name: 'Jour des Martyrs', nameAr: 'يوم الشهداء', emoji: '🕊️',
      color: '#374151', colorEnd: '#1F2937',
      message: 'Hommage à ceux qui ont sacrifié leur vie pour la Tunisie.',
      windowDays: 0,
    },
  },
  {
    month: 5, day: 1,
    holiday: {
      type: 'national', name: 'Fête du Travail', nameAr: 'عيد الشغل', emoji: '⚒️',
      color: '#7C2D00', colorEnd: '#DC6803',
      message: 'Bonne fête du travail ! Ensemble pour une ville plus saine.',
      windowDays: 1,
    },
  },
  {
    month: 7, day: 25,
    holiday: {
      type: 'national', name: 'Fête de la République', nameAr: 'عيد الجمهورية', emoji: '🇹🇳',
      color: '#CC0000', colorEnd: '#8B0000',
      message: 'Bonne fête de la République ! La citoyenneté, c\'est aussi signaler.',
      windowDays: 1,
    },
  },
  {
    month: 8, day: 13,
    holiday: {
      type: 'national', name: 'Fête de la Femme', nameAr: 'يوم المرأة', emoji: '👩',
      color: '#7E22CE', colorEnd: '#A855F7',
      message: 'Bonne fête de la femme tunisienne ! Votre voix compte dans notre ville.',
      windowDays: 1,
    },
  },
  {
    month: 10, day: 15,
    holiday: {
      type: 'national', name: 'Fête de l\'Évacuation', nameAr: 'عيد الجلاء', emoji: '🌟',
      color: '#CC0000', colorEnd: '#8B0000',
      message: 'Vive la Tunisie souveraine !',
      windowDays: 1,
    },
  },
];

// ── Islamic holidays — hardcoded for 2024-2028 (lunar calendar) ─────────────
// Eid al-Fitr (end of Ramadan): 1 Shawwal
// Eid al-Adha (sacrifice): 10 Dhul Hijja
const ISLAMIC_HOLIDAYS: { year: number; month: number; day: number; holiday: TunisianHoliday }[] = [
  // Eid al-Fitr
  { year: 2024, month: 4,  day: 10, holiday: { type: 'eid_fitr', name: 'Aïd el-Fitr', nameAr: 'عيد الفطر', emoji: '🌙', color: '#064E3B', colorEnd: '#059669', message: 'عيد مبارك ! Joyeux Aïd el-Fitr à toute la communauté tunisienne. Bonne fête !', windowDays: 2 } },
  { year: 2025, month: 3,  day: 30, holiday: { type: 'eid_fitr', name: 'Aïd el-Fitr', nameAr: 'عيد الفطر', emoji: '🌙', color: '#064E3B', colorEnd: '#059669', message: 'عيد مبارك ! Joyeux Aïd el-Fitr à toute la communauté tunisienne. Bonne fête !', windowDays: 2 } },
  { year: 2026, month: 3,  day: 20, holiday: { type: 'eid_fitr', name: 'Aïd el-Fitr', nameAr: 'عيد الفطر', emoji: '🌙', color: '#064E3B', colorEnd: '#059669', message: 'عيد مبارك ! Joyeux Aïd el-Fitr à toute la communauté tunisienne. Bonne fête !', windowDays: 2 } },
  { year: 2027, month: 3,  day: 9,  holiday: { type: 'eid_fitr', name: 'Aïd el-Fitr', nameAr: 'عيد الفطر', emoji: '🌙', color: '#064E3B', colorEnd: '#059669', message: 'عيد مبارك ! Joyeux Aïd el-Fitr à toute la communauté tunisienne. Bonne fête !', windowDays: 2 } },
  { year: 2028, month: 2,  day: 26, holiday: { type: 'eid_fitr', name: 'Aïd el-Fitr', nameAr: 'عيد الفطر', emoji: '🌙', color: '#064E3B', colorEnd: '#059669', message: 'عيد مبارك ! Joyeux Aïd el-Fitr à toute la communauté tunisienne. Bonne fête !', windowDays: 2 } },

  // Eid al-Adha
  { year: 2024, month: 6,  day: 16, holiday: { type: 'eid_adha', name: 'Aïd el-Adha', nameAr: 'عيد الأضحى', emoji: '🐑', color: '#78350F', colorEnd: '#D97706', message: 'عيد أضحى مبارك ! Joyeux Aïd el-Adha à vous et vos familles. Bonne fête du sacrifice !', windowDays: 2 } },
  { year: 2025, month: 6,  day: 6,  holiday: { type: 'eid_adha', name: 'Aïd el-Adha', nameAr: 'عيد الأضحى', emoji: '🐑', color: '#78350F', colorEnd: '#D97706', message: 'عيد أضحى مبارك ! Joyeux Aïd el-Adha à vous et vos familles. Bonne fête du sacrifice !', windowDays: 2 } },
  { year: 2026, month: 5,  day: 26, holiday: { type: 'eid_adha', name: 'Aïd el-Adha', nameAr: 'عيد الأضحى', emoji: '🐑', color: '#78350F', colorEnd: '#D97706', message: 'عيد أضحى مبارك ! Joyeux Aïd el-Adha à vous et vos familles. Bonne fête du sacrifice !', windowDays: 2 } },
  { year: 2027, month: 5,  day: 16, holiday: { type: 'eid_adha', name: 'Aïd el-Adha', nameAr: 'عيد الأضحى', emoji: '🐑', color: '#78350F', colorEnd: '#D97706', message: 'عيد أضحى مبارك ! Joyeux Aïd el-Adha à vous et vos familles. Bonne fête du sacrifice !', windowDays: 2 } },
  { year: 2028, month: 5,  day: 4,  holiday: { type: 'eid_adha', name: 'Aïd el-Adha', nameAr: 'عيد الأضحى', emoji: '🐑', color: '#78350F', colorEnd: '#D97706', message: 'عيد أضحى مبارك ! Joyeux Aïd el-Adha à vous et vos familles. Bonne fête du sacrifice !', windowDays: 2 } },
];

@Injectable({ providedIn: 'root' })
export class HolidayService {

  /** Returns today's holiday if one is active (within the window), else null */
  getTodayHoliday(): TunisianHoliday | null {
    // Allow ?demo=eid_fitr | eid_adha | national | holiday=independence etc.
    const params = new URLSearchParams(window.location.search);
    const demoH  = params.get('holiday');
    if (demoH) {
      return this._getDemoHoliday(demoH);
    }

    const now   = new Date();
    const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };

    // Check Islamic holidays first (higher priority visually)
    for (const entry of ISLAMIC_HOLIDAYS) {
      if (entry.year !== today.year) continue;
      const holidayDate = new Date(entry.year, entry.month - 1, entry.day);
      const diffDays = Math.round((now.getTime() - holidayDate.getTime()) / 86400000);
      if (diffDays >= -1 && diffDays <= entry.holiday.windowDays) {
        return entry.holiday;
      }
    }

    // Check national holidays
    for (const entry of NATIONAL_HOLIDAYS) {
      if (entry.month !== today.month || entry.day !== today.day) continue;
      return entry.holiday;
    }

    // Check national holidays in window (day before / day after)
    for (const entry of NATIONAL_HOLIDAYS) {
      if (entry.holiday.windowDays < 1) continue;
      const holidayDate = new Date(today.year, entry.month - 1, entry.day);
      const diffDays = Math.round((now.getTime() - holidayDate.getTime()) / 86400000);
      if (diffDays >= -1 && diffDays <= entry.holiday.windowDays) {
        return entry.holiday;
      }
    }

    return null;
  }

  private _getDemoHoliday(key: string): TunisianHoliday | null {
    if (key === 'eid_fitr') return ISLAMIC_HOLIDAYS.find(h => h.holiday.type === 'eid_fitr')!.holiday;
    if (key === 'eid_adha') return ISLAMIC_HOLIDAYS.find(h => h.holiday.type === 'eid_adha')!.holiday;
    if (key === 'independence') return NATIONAL_HOLIDAYS.find(h => h.month === 3 && h.day === 20)!.holiday;
    if (key === 'republic') return NATIONAL_HOLIDAYS.find(h => h.month === 7)!.holiday;
    if (key === 'women') return NATIONAL_HOLIDAYS.find(h => h.month === 8)!.holiday;
    return NATIONAL_HOLIDAYS[0].holiday; // New Year as default demo
  }
}
