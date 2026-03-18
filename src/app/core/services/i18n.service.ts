import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Lang = 'fr' | 'en';

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  fr: {
    /* Navbar */
    'nav.how':          'Comment ça marche',
    'nav.impact':       'Impact',
    'nav.map':          'Carte',
    'nav.testimonials': 'Témoignages',
    'nav.login':        'Se connecter',
    'nav.report':       'Signaler',

    /* Hero */
    'hero.badge':       'Plateforme officielle · Tunis',
    'hero.line1':       'Ensemble',
    'hero.line2':       'améliorons',
    'hero.line3':       'notre',
    'hero.accent':      'ville.',
    'hero.desc':        'Signalez les problèmes urbains de votre quartier en quelques secondes. Notre IA les analyse et les transmet à l\'équipe compétente. Réponse garantie sous 48h.',
    'hero.cta1':        'Signaler maintenant',
    'hero.cta2':        'Voir les signalements',
    'hero.trust1':      'Gratuit pour tous les citoyens',
    'hero.trust2':      'Réponse sous 48h garantie',
    'hero.trust3':      'IA intégrée pour la priorisation',

    /* Dashboard live */
    'live.title':       'Activité en direct',
    'live.subtitle':    'Signalements résolus aujourd\'hui',
    'live.resolved':    'résolus',
    'live.pending':     'en cours',
    'live.team':        'équipes actives',
    'live.recent':      'Signalements récents',
    'live.status.resolved':    'Résolu',
    'live.status.in-progress': 'En cours',
    'live.status.pending':     'En attente',

    /* Sections */
    'how.eyebrow':      'Processus',
    'how.title':        'De la photo au camion de réparation.',
    'how.sub':          'En moins de 48h, votre signalement est analysé, priorisé et assigné à l\'équipe terrain.',
    'how.step1.title':  'Photographiez & signalez',
    'how.step1.desc':   'Prenez une photo depuis votre smartphone. Ajoutez une description et soumettez en moins de 30 secondes.',
    'how.step2.title':  'L\'IA analyse & priorise',
    'how.step2.desc':   'Notre IA analyse votre signalement, détermine le niveau de priorité et identifie l\'équipe terrain compétente.',
    'how.step3.title':  'L\'équipe intervient',
    'how.step3.desc':   'L\'équipe reçoit la mission, intervient rapidement et clôture le dossier. Vous êtes notifié à chaque étape.',

    /* CTA */
    'cta.tag':          'Rejoignez la communauté',
    'cta.title1':       'Prêt à changer',
    'cta.title2':       'votre',
    'cta.title3':       'quartier ?',
    'cta.sub':          'Rejoignez des milliers de citoyens actifs qui contribuent chaque jour à une ville plus propre.',
    'cta.btn1':         'Faire mon premier signalement',
    'cta.btn2':         'Créer un compte gratuit',
    'cta.note':         'Sans inscription · Données protégées · Réponse sous 48h',
  },

  en: {
    /* Navbar */
    'nav.how':          'How it works',
    'nav.impact':       'Impact',
    'nav.map':          'Map',
    'nav.testimonials': 'Testimonials',
    'nav.login':        'Sign in',
    'nav.report':       'Report',

    /* Hero */
    'hero.badge':       'Official platform · Tunis',
    'hero.line1':       'Together',
    'hero.line2':       'let\'s improve',
    'hero.line3':       'our',
    'hero.accent':      'city.',
    'hero.desc':        'Report urban issues in your neighbourhood in seconds. Our AI analyses them and forwards them to the right team. Response guaranteed within 48h.',
    'hero.cta1':        'Report now',
    'hero.cta2':        'View reports',
    'hero.trust1':      'Free for all citizens',
    'hero.trust2':      '48h response guaranteed',
    'hero.trust3':      'AI-powered prioritisation',

    /* Dashboard live */
    'live.title':       'Live activity',
    'live.subtitle':    'Issues resolved today',
    'live.resolved':    'resolved',
    'live.pending':     'in progress',
    'live.team':        'active teams',
    'live.recent':      'Recent reports',
    'live.status.resolved':    'Resolved',
    'live.status.in-progress': 'In progress',
    'live.status.pending':     'Pending',

    /* Sections */
    'how.eyebrow':      'Process',
    'how.title':        'From photo to repair crew.',
    'how.sub':          'In less than 48h, your report is analysed, prioritised and assigned to the field team.',
    'how.step1.title':  'Photograph & report',
    'how.step1.desc':   'Take a photo from your smartphone. Add a description and submit in under 30 seconds.',
    'how.step2.title':  'AI analyses & prioritises',
    'how.step2.desc':   'Our AI analyses your report, determines priority and identifies the most qualified nearby team.',
    'how.step3.title':  'Team responds',
    'how.step3.desc':   'The field team receives the mission, acts quickly and closes the case with before/after photos.',

    /* CTA */
    'cta.tag':          'Join the community',
    'cta.title1':       'Ready to change',
    'cta.title2':       'your',
    'cta.title3':       'neighbourhood?',
    'cta.sub':          'Join thousands of active citizens who contribute every day to a cleaner, safer city.',
    'cta.btn1':         'Make my first report',
    'cta.btn2':         'Create a free account',
    'cta.note':         'No sign-up · Data protected · 48h response',
  },
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private _lang$ = new BehaviorSubject<Lang>('fr');
  readonly lang$  = this._lang$.asObservable();

  get lang(): Lang { return this._lang$.value; }

  set(lang: Lang): void {
    this._lang$.next(lang);
    document.documentElement.lang = lang;
    localStorage.setItem('madina_lang', lang);
  }

  init(): void {
    const saved = localStorage.getItem('madina_lang') as Lang | null;
    if (saved === 'en' || saved === 'fr') this.set(saved);
    else {
      const browser = navigator.language.startsWith('en') ? 'en' : 'fr';
      this.set(browser as Lang);
    }
  }

  t(key: string): string {
    return TRANSLATIONS[this.lang][key] ?? TRANSLATIONS['fr'][key] ?? key;
  }
}
