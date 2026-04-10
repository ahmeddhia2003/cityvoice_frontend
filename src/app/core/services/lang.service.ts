import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { I18nService } from './i18n.service';

export type Lang = 'fr' | 'en';

export interface Translations {
  // Navbar
  nav_how: string;
  nav_impact: string;
  nav_map: string;
  nav_testi: string;
  nav_login: string;
  nav_report: string;
  nav_events: string;

  // Hero
  hero_badge: string;
  hero_title1: string;
  hero_title2: string;
  hero_title3a: string;
  hero_title3b: string;
  hero_desc: string;
  hero_btn1: string;
  hero_btn2: string;
  hero_trust1: string;
  hero_trust2: string;
  hero_trust3: string;

  // Live panel
  live_title: string;
  live_subtitle: string;
  live_resolved: string;
  live_inprogress: string;
  live_pending: string;
  live_today: string;
  live_feed_title: string;

  // How
  how_pill: string;
  how_title: string;
  how_sub: string;
  how_s1_title: string; how_s1_desc: string;
  how_s2_title: string; how_s2_desc: string;
  how_s3_title: string; how_s3_desc: string;

  // Stats
  stats_title: string;
  stats_sub: string;
  stat1_label: string;
  stat2_label: string;
  stat3_label: string;
  stat4_label: string;
  stat_trend: string;

  // Map
  map_pill: string;
  map_title: string;
  map_dim: string;
  map_all: string;
  map_pending: string;
  map_progress: string;
  map_resolved: string;

  // Testimonials
  testi_pill: string;
  testi_title: string;
  testi_dim: string;

  // CTA
  cta_pill: string;
  cta_title1: string;
  cta_title2: string;
  cta_title3: string;
  cta_sub: string;
  cta_btn1: string;
  cta_btn2: string;
  cta_note: string;
  cta_stat1: string;
  cta_stat2: string;
  cta_stat3: string;
}

const FR: Translations = {
  nav_how:'Comment ça marche', nav_impact:'Impact', nav_map:'Carte', nav_testi:'Témoignages',
  nav_login:'Se connecter', nav_report:'Signaler',
  nav_events: 'Événements',

  hero_badge:'Plateforme officielle · Tunis',
  hero_title1:'Ensemble', hero_title2:'améliorons', hero_title3a:'notre ', hero_title3b:'ville.',
  hero_desc:'Signalez les problèmes urbains de votre quartier en quelques secondes. Notre IA les analyse et les transmet à l\'équipe compétente. Réponse garantie sous 48h.',
  hero_btn1:'Signaler maintenant', hero_btn2:'Voir les signalements →',
  hero_trust1:'Gratuit pour tous les citoyens',
  hero_trust2:'Réponse sous 48h garantie',
  hero_trust3:'IA intégrée pour la priorisation',

  live_title:'Activité en direct', live_subtitle:'Mis à jour en temps réel',
  live_resolved:'Résolus', live_inprogress:'En cours', live_pending:'En attente',
  live_today:'Aujourd\'hui', live_feed_title:'Dernières activités',

  how_pill:'Processus', how_title:'De la photo au camion de réparation.',
  how_sub:'En moins de 48h, votre signalement est analysé, priorisé et assigné à l\'équipe terrain.',
  how_s1_title:'Photographiez & signalez', how_s1_desc:'Prenez une photo depuis votre smartphone. Ajoutez une description et soumettez en moins de 30 secondes.',
  how_s2_title:'L\'IA analyse & priorise', how_s2_desc:'Notre IA analyse votre signalement, détermine le niveau de priorité et identifie l\'équipe terrain compétente.',
  how_s3_title:'L\'équipe intervient', how_s3_desc:'L\'équipe reçoit la mission, intervient rapidement et clôture le dossier. Vous êtes notifié à chaque étape.',

  stats_title:'Un impact réel', stats_sub:'Des milliers de problèmes résolus grâce à l\'action citoyenne.',
  stat1_label:'Signalements soumis', stat2_label:'Problèmes résolus',
  stat3_label:'Citoyens actifs', stat4_label:'Délai moyen de résolution',
  stat_trend:'+23% ce mois',

  map_pill:'Carte en direct', map_title:'Signalements', map_dim:'dans votre ville',
  map_all:'Tous', map_pending:'En attente', map_progress:'En cours', map_resolved:'Résolus',

  testi_pill:'Citoyens', testi_title:'Ce qu\'ils ', testi_dim:'disent',

  cta_pill:'Rejoignez la communauté',
  cta_title1:'Prêt à changer', cta_title2:'votre', cta_title3:'quartier ?',
  cta_sub:'Rejoignez des milliers de citoyens actifs qui contribuent chaque jour à une ville plus propre, plus sûre et plus agréable pour tous.',
  cta_btn1:'Faire mon premier signalement', cta_btn2:'Créer un compte gratuit',
  cta_note:'Sans inscription · Données protégées · Réponse sous 48h',
  cta_stat1:'Signalements soumis', cta_stat2:'Problèmes résolus', cta_stat3:'Citoyens nous font confiance',
};

const EN: Translations = {
  nav_how:'How it works', nav_impact:'Impact', nav_map:'Map', nav_testi:'Testimonials',
  nav_login:'Sign in', nav_report:'Report',
  nav_events: 'Events',

  hero_badge:'Official platform · Tunis',
  hero_title1:'Together', hero_title2:'let\'s improve', hero_title3a:'our ', hero_title3b:'city.',
  hero_desc:'Report urban problems in your neighbourhood in seconds. Our AI analyses them and forwards them to the right team. Response guaranteed within 48h.',
  hero_btn1:'Report now', hero_btn2:'View reports →',
  hero_trust1:'Free for all citizens',
  hero_trust2:'Response within 48h guaranteed',
  hero_trust3:'AI-powered prioritisation',

  live_title:'Live activity', live_subtitle:'Updated in real time',
  live_resolved:'Resolved', live_inprogress:'In progress', live_pending:'Pending',
  live_today:'Today', live_feed_title:'Latest activity',

  how_pill:'Process', how_title:'From photo to repair truck.',
  how_sub:'In less than 48h, your report is analysed, prioritised and assigned to the field team.',
  how_s1_title:'Photograph & report', how_s1_desc:'Take a photo from your smartphone. Add a description and submit in under 30 seconds.',
  how_s2_title:'AI analyses & prioritises', how_s2_desc:'Our AI analyses your report, determines its priority level and identifies the most competent available team.',
  how_s3_title:'Team responds', how_s3_desc:'The field team receives the mission, responds quickly and closes the case. You\'re notified at every step.',

  stats_title:'Real impact', stats_sub:'Thousands of problems solved through citizen action.',
  stat1_label:'Reports submitted', stat2_label:'Problems resolved',
  stat3_label:'Active citizens', stat4_label:'Average resolution time',
  stat_trend:'+23% this month',

  map_pill:'Live map', map_title:'Reports', map_dim:'in your city',
  map_all:'All', map_pending:'Pending', map_progress:'In progress', map_resolved:'Resolved',

  testi_pill:'Citizens', testi_title:'What they ', testi_dim:'say',

  cta_pill:'Join the community',
  cta_title1:'Ready to change', cta_title2:'your', cta_title3:'neighbourhood?',
  cta_sub:'Join thousands of active citizens who contribute every day to a cleaner, safer and more pleasant city for everyone.',
  cta_btn1:'Make my first report', cta_btn2:'Create a free account',
  cta_note:'No registration · Data protected · Response within 48h',
  cta_stat1:'Reports submitted', cta_stat2:'Problems resolved', cta_stat3:'Citizens trust us',
};

@Injectable({ providedIn: 'root' })
export class LangService {
  constructor(private i18n: I18nService) {}
  private _lang = new BehaviorSubject<Lang>('fr');
  lang$ = this._lang.asObservable();

  get current(): Lang { return this._lang.value; }
  get t(): Translations { return this._lang.value === 'fr' ? FR : EN; }

  switch(lang: Lang): void { this._lang.next(lang); 
    this.i18n.set(lang as any); 
  }
  toggle(): void { this._lang.next(this._lang.value === 'fr' ? 'en' : 'fr'); }
}
