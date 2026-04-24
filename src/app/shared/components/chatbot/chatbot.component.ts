import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService }         from '../../../core/services/auth.service';
import { WeatherService, WeatherAlert } from '../../../core/services/weather.service';
import { LangService }         from '../../../core/services/lang.service';
import { SoundService }        from '../../../core/services/sound.service';
import { SignalementService, SignalementResponse } from '../../../core/services/signalement.service';
import { ChatbotAiService, ChatHistoryMessage } from '../../../core/services/chatbot-ai.service';

// Real stats shape from /api/v1/signalements/stats
interface LiveStats {
  total:     number;
  resolus:   number;
  enCours:   number;
  enAttente: number;
  tauxResolution?: number;   // computed client-side
}

declare const gsap: any;

// ─── Message model ────────────────────────────────────────────────────────────
export interface ChatMessage {
  from: 'bot' | 'user';
  text: string;
  chips?: string[];
  time: Date;
}

// ─── Intent keywords ──────────────────────────────────────────────────────────
const INTENT_MAP: { keywords: RegExp; intent: string }[] = [
  { keywords: /signal|report|probl[eè]me|incident|signalement/i,  intent: 'REPORT'   },
  { keywords: /m[eé]t[eé]o|weather|temp[eé]rature|pluie|soleil/i, intent: 'WEATHER'  },
  { keywords: /mes signal|my report|historique|suivi/i,            intent: 'MY_REPORTS'},
  { keywords: /stat|chiffre|impact|nombre|donn[eé]e/i,            intent: 'STATS'    },
  { keywords: /comment|how|aide|help|marche|fonctionn/i,           intent: 'HOW'      },
  { keywords: /urgence|sos|danger|urgent|emergency/i,              intent: 'EMERGENCY'},
  { keywords: /salut|bonjour|hi|hello|hey/i,                       intent: 'GREET'    },
  { keywords: /merci|thank|super|parfait|nickel|cool/i,            intent: 'THANKS'   },
  { keywords: /point|badge|classement|leaderboard|score/i,         intent: 'POINTS'   },
  { keywords: /carte|map|voir|localisation/i,                      intent: 'MAP'      },
];

// ─── Bot replies ──────────────────────────────────────────────────────────────
type BotReply = { text: string; chips?: string[] };

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css'],
})
export class ChatbotComponent implements OnInit, OnDestroy {

  isOpen    = false;
  typing    = false;
  messages: ChatMessage[] = [];
  inputText = '';

  weather: WeatherAlert | null = null;
  private isAuth         = false;
  private userName       = '';
  private userRole       = '';
  private userId         = '';
  private liveStats: LiveStats | null = null;
  private mySignalements: SignalementResponse[] = [];
  private weatherSub!: Subscription;

  /** Historique envoyé au LLM (max 10 tours) */
  private aiHistory: ChatHistoryMessage[] = [];
  /** Désactiver temporairement l'IA si le service est indisponible */
  private aiAvailable = true;

  @ViewChild('chatBody') chatBodyRef!: ElementRef<HTMLDivElement>;
  @ViewChild('chatInput') inputRef!: ElementRef<HTMLInputElement>;

  constructor(
    private auth:        AuthService,
    private weatherSvc:  WeatherService,
    public  lang:        LangService,
    private sound:       SoundService,
    private router:      Router,
    private cdr:         ChangeDetectorRef,
    private sigSvc:      SignalementService,
    private chatAi:      ChatbotAiService,
  ) {}

  ngOnInit(): void {
    // Auth state
    const user = this.auth.getCurrentUser();
    this.isAuth   = this.auth.isLoggedIn();
    this.userName = user?.email?.split('@')[0] || '';
    this.userRole = user?.role || '';
    this.userId   = user?.userId || '';

    // Weather state
    this.weatherSub = this.weatherSvc.getAlert().subscribe(a => {
      this.weather = a;
    });

    // Live city stats (background prefetch, no loading spinner)
    this.sigSvc.getStats().subscribe({
      next: (s: Record<string, number>) => {
        const total   = s['total']     ?? 0;
        const resolus = s['resolus']   ?? 0;
        this.liveStats = {
          total,
          resolus,
          enCours:   s['enCours']   ?? 0,
          enAttente: s['enAttente'] ?? 0,
          tauxResolution: total > 0 ? Math.round((resolus / total) * 100) : 0,
        };
      },
      error: () => { /* keep liveStats null → fallback to static text */ }
    });

    // My signalements for authenticated citizens
    if (this.isAuth && this.userRole === 'CITOYEN' && this.userId) {
      this.sigSvc.getMes(this.userId).subscribe({
        next: (list) => { this.mySignalements = list; },
        error: () => {}
      });
    }
  }

  ngOnDestroy(): void {
    this.weatherSub?.unsubscribe();
  }

  // ─── Toggle panel ────────────────────────────────────────────────────────
  toggleChat(): void {
    this.sound.nav();
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      // Réessayer l'IA à chaque réouverture (le service a pu être (re)démarré)
      this.aiAvailable = true;
      if (this.messages.length === 0) {
        setTimeout(() => this.sendWelcome(), 200);
      }
      setTimeout(() => {
        this.animateOpen();
        this.inputRef?.nativeElement.focus();
      }, 10);
    }
  }

  closeChat(): void {
    this.isOpen = false;
  }

  // ─── Welcome message ─────────────────────────────────────────────────────
  private sendWelcome(): void {
    const name   = this.userName ? `, ${this.capitalise(this.userName)}` : '';
    const isEn   = this.lang.current === 'en';

    let text: string;
    let chips: string[];

    if (isEn) {
      text  = `👋 Hey${name}! I'm **Madina Assistant** — your smart city helper. How can I help you today?`;
      chips = ['🗺️ See the map', '📊 City stats', '🌤️ Weather', '🔧 Report issue'];
    } else {
      text  = `👋 Bonjour${name} ! Je suis **l'assistant Madina** — votre aide pour la ville intelligente. Comment puis-je vous aider ?`;
      chips = ['🗺️ Voir la carte', '📊 Statistiques', '🌤️ Météo', '🔧 Signaler'];
    }

    // Personalize for authenticated
    if (this.isAuth && this.userRole === 'CITOYEN') {
      chips.push(isEn ? '📋 My reports' : '📋 Mes signalements');
    }

    // Add weather chip if alert active
    if (this.weather?.level) {
      const weatherChip = `${this.weather.icon} ${this.weather.title}`;
      chips.unshift(weatherChip);
    }

    this.addBotMessage(text, chips);
  }

  // ─── Send a message ───────────────────────────────────────────────────────
  send(text?: string): void {
    const msg = (text ?? this.inputText).trim();
    if (!msg) return;

    this.sound.click();
    this.addUserMessage(msg);
    this.inputText = '';

    const intent = this.detectIntent(msg);

    // Intents structurés → rule-based (navigation, météo, stats réelles, urgence)
    if (intent !== 'FALLBACK') {
      this.showTyping(() => {
        const reply = this.buildReply(intent, msg);
        this.addBotMessage(reply.text, reply.chips);
        // Garder la trace dans l'historique IA
        this._pushToAiHistory('user', msg);
        this._pushToAiHistory('assistant', reply.text);
      });
      return;
    }

    // FALLBACK → essayer le LLM si disponible
    if (this.aiAvailable) {
      this._askAi(msg);
    } else {
      this.showTyping(() => {
        const reply = this.buildFallbackReply(this.lang.current === 'en', msg);
        this.addBotMessage(reply.text, reply.chips);
      });
    }
  }

  /** Appelle le service IA et affiche la réponse, ou bascule sur le fallback */
  private _askAi(msg: string): void {
    this.typing = true;
    this.cdr.detectChanges();
    this.scrollBottom();

    const isEn = this.lang.current === 'en';

    this.chatAi.chat({
      message: msg,
      history: [...this.aiHistory],
      lang:    this.lang.current,
      user_context: {
        name:  this.userName   || undefined,
        role:  this.userRole   || undefined,
        stats: this.liveStats  ? {
          total:     this.liveStats.total,
          resolus:   this.liveStats.resolus,
          enCours:   this.liveStats.enCours,
          enAttente: this.liveStats.enAttente,
        } : undefined,
      },
    }).subscribe(reply => {
      this.typing = false;

      if (reply) {
        // Succès : afficher la réponse IA
        this._pushToAiHistory('user', msg);
        this._pushToAiHistory('assistant', reply);
        this.addBotMessage(reply);
      } else {
        // Service indisponible → fallback rule-based + désactiver pour cette session
        this.aiAvailable = false;
        const fallback = this.buildFallbackReply(isEn, msg);
        this.addBotMessage(fallback.text, fallback.chips);
      }

      this.cdr.detectChanges();
    });
  }

  /** Ajoute un message à l'historique IA (fenêtre glissante de 10 tours) */
  private _pushToAiHistory(role: 'user' | 'assistant', content: string): void {
    this.aiHistory.push({ role, content });
    if (this.aiHistory.length > 20) {          // 20 = 10 tours user+assistant
      this.aiHistory = this.aiHistory.slice(-20);
    }
  }

  onChipClick(chip: string): void {
    this.send(chip);
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  // ─── Intent detection ─────────────────────────────────────────────────────
  private detectIntent(msg: string): string {
    for (const { keywords, intent } of INTENT_MAP) {
      if (keywords.test(msg)) return intent;
    }
    return 'FALLBACK';
  }

  // ─── Reply builder ────────────────────────────────────────────────────────
  private buildReply(intent: string, raw: string): BotReply {
    const isEn = this.lang.current === 'en';

    switch (intent) {

      case 'GREET':
        return {
          text: isEn
            ? `😊 Hello! What can I help you with today?`
            : `😊 Bonjour ! Qu'est-ce que je peux faire pour vous ?`,
          chips: isEn
            ? ['📊 Stats', '🗺️ Map', '🔧 Report']
            : ['📊 Stats', '🗺️ Carte', '🔧 Signaler'],
        };

      case 'THANKS':
        return {
          text: isEn
            ? `🙏 Happy to help! Anything else?`
            : `🙏 Avec plaisir ! Autre chose ?`,
          chips: isEn
            ? ['🏠 Home', '🗺️ Map']
            : ['🏠 Accueil', '🗺️ Carte'],
        };

      case 'WEATHER':
        return this.buildWeatherReply(isEn);

      case 'REPORT':
        return this.buildReportReply(isEn);

      case 'MY_REPORTS':
        return this.buildMyReportsReply(isEn);

      case 'STATS':
        return this.buildStatsReply(isEn);

      case 'HOW':
        return this.buildHowReply(isEn);

      case 'EMERGENCY':
        return this.buildEmergencyReply(isEn);

      case 'POINTS':
        return this.buildPointsReply(isEn);

      case 'MAP':
        return {
          text: isEn
            ? `🗺️ The interactive map shows all reported issues in your city in real-time. You can filter by type, status, and zone.`
            : `🗺️ La carte interactive affiche tous les signalements de votre ville en temps réel. Filtrez par type, statut et zone.`,
          chips: isEn ? ['🔧 Report issue', '📊 Stats'] : ['🔧 Signaler', '📊 Stats'],
        };

      default: // FALLBACK
        return this.buildFallbackReply(isEn, raw);
    }
  }

  // ─── Weather reply ────────────────────────────────────────────────────────
  private buildWeatherReply(isEn: boolean): BotReply {
    if (!this.weather) {
      return {
        text: isEn
          ? `🌤️ I'm fetching weather data... it seems clear right now! Perfect conditions to go inspect your neighbourhood.`
          : `🌤️ La météo est en cours de chargement... tout semble calme ! C'est le bon moment pour inspecter votre quartier.`,
        chips: isEn ? ['🔧 Report issue', '🗺️ Map'] : ['🔧 Signaler', '🗺️ Carte'],
      };
    }

    const { icon, title, message, level, temperature, description, suggestedTypes } = this.weather;

    if (!level) {
      return {
        text: isEn
          ? `☀️ Weather is clear — ${temperature}°C, ${description}. Great time to report any issues you spot outdoors!`
          : `☀️ Météo dégagée — ${temperature}°C, ${description}. C'est le bon moment pour signaler des problèmes repérés dehors !`,
        chips: isEn ? ['🔧 Report issue', '🗺️ Map'] : ['🔧 Signaler', '🗺️ Carte'],
      };
    }

    const typesText = suggestedTypes.slice(0, 3)
      .map(t => `${t.emoji} ${t.label}`)
      .join(' · ');

    return {
      text: isEn
        ? `${icon} **${title}** — ${temperature}°C · ${description}\n\n${message}\n\n💡 Suggested reports: ${typesText}`
        : `${icon} **${title}** — ${temperature}°C · ${description}\n\n${message}\n\n💡 Signalements suggérés : ${typesText}`,
      chips: isEn ? ['🔧 Report now', '🗺️ See map'] : ['🔧 Signaler maintenant', '🗺️ Voir la carte'],
    };
  }

  // ─── Report reply ─────────────────────────────────────────────────────────
  private buildReportReply(isEn: boolean): BotReply {
    if (!this.isAuth) {
      return {
        text: isEn
          ? `🔧 To file a report, you need to be logged in. Create a free account in seconds!`
          : `🔧 Pour signaler un problème, vous devez être connecté. Créez un compte gratuitement en quelques secondes !`,
        chips: isEn
          ? ['🔑 Sign in', '📋 Create account', '📊 Stats']
          : ['🔑 Se connecter', '📋 Créer un compte', '📊 Stats'],
      };
    }

    // Authenticated — guide them
    let weatherHint = '';
    if (this.weather?.level && this.weather.suggestedTypes.length) {
      const suggested = this.weather.suggestedTypes[0];
      weatherHint = isEn
        ? `\n\n${this.weather.icon} Given current ${this.weather.level} conditions, consider reporting: **${suggested.label}** ${suggested.emoji}`
        : `\n\n${this.weather.icon} Vu la météo actuelle (${this.weather.level}), pensez à signaler : **${suggested.label}** ${suggested.emoji}`;
    }

    return {
      text: isEn
        ? `🔧 Great! Here's how to file a report:\n\n1️⃣ Click **"Report"** in the navbar\n2️⃣ Allow location access\n3️⃣ Choose issue type & describe\n4️⃣ Add a photo (optional)\n5️⃣ Submit — our AI triages it instantly!${weatherHint}`
        : `🔧 Voici comment signaler un problème :\n\n1️⃣ Cliquez sur **"Signaler"** dans la navbar\n2️⃣ Autorisez la localisation\n3️⃣ Choisissez le type et décrivez\n4️⃣ Ajoutez une photo (optionnel)\n5️⃣ Envoyez — notre IA triège en temps réel !${weatherHint}`,
      chips: isEn ? ['🚀 Go report now', '🗺️ Map', '📊 Stats'] : ['🚀 Signaler maintenant', '🗺️ Carte', '📊 Stats'],
    };
  }

  // ─── My reports reply ─────────────────────────────────────────────────────
  private buildMyReportsReply(isEn: boolean): BotReply {
    if (!this.isAuth) {
      return {
        text: isEn
          ? `🔑 You need to be logged in to see your reports.`
          : `🔑 Vous devez être connecté pour voir vos signalements.`,
        chips: isEn ? ['🔑 Sign in'] : ['🔑 Se connecter'],
      };
    }

    if (this.userRole !== 'CITOYEN') {
      return {
        text: isEn
          ? `👔 As a **${this.getRoleLabel()}**, you can manage reports from your dashboard.`
          : `👔 En tant que **${this.getRoleLabel()}**, vous pouvez gérer les signalements depuis votre tableau de bord.`,
        chips: isEn ? ['🗺️ Map', '📊 Stats'] : ['🗺️ Carte', '📊 Stats'],
      };
    }

    // Build personal stats from prefetched data
    const list = this.mySignalements;
    if (list.length > 0) {
      const total    = list.length;
      const resolus  = list.filter(s => s.statut === 'RESOLU').length;
      const enCours  = list.filter(s => s.statut === 'EN_COURS').length;
      const attente  = list.filter(s => s.statut === 'EN_ATTENTE').length;
      const taux     = Math.round((resolus / total) * 100);
      const votes    = list.reduce((acc, s) => acc + (s.votes ?? 0), 0);

      return {
        text: isEn
          ? `📋 **Your personal report stats** (live from API):\n\n📦 **${total}** reports submitted\n✅ **${resolus}** resolved (${taux}%)\n🔵 **${enCours}** in progress\n🟡 **${attente}** pending\n👍 **${votes}** community votes received\n\nYou earn ⭐ points for each report. Keep it up!`
          : `📋 **Vos statistiques personnelles** (issues de l'API) :\n\n📦 **${total}** signalements soumis\n✅ **${resolus}** résolus (${taux} %)\n🔵 **${enCours}** en cours\n🟡 **${attente}** en attente\n👍 **${votes}** votes de la communauté\n\nVous gagnez des ⭐ points pour chaque signalement. Continuez !`,
        chips: isEn
          ? ['📋 View my reports', '⭐ Leaderboard', '🔧 New report']
          : ['📋 Mes signalements', '⭐ Classement', '🔧 Nouveau signalement'],
      };
    }

    return {
      text: isEn
        ? `📋 Your reports page shows all submissions with their AI-assigned status:\n\n• 🟡 **Pending** — received, queued\n• 🔵 **In progress** — team assigned\n• ✅ **Resolved** — done!\n\nYou earn ⭐ points for each report!`
        : `📋 Votre page de signalements affiche tous vos envois avec leur statut IA :\n\n• 🟡 **En attente** — reçu, en file\n• 🔵 **En cours** — équipe assignée\n• ✅ **Résolu** — terminé !\n\nVous gagnez des ⭐ points pour chaque signalement !`,
      chips: isEn
        ? ['📋 View my reports', '⭐ Leaderboard']
        : ['📋 Mes signalements', '⭐ Classement'],
    };
  }

  // ─── Stats reply ──────────────────────────────────────────────────────────
  private buildStatsReply(isEn: boolean): BotReply {
    const s = this.liveStats;

    if (s) {
      const fmt = (n: number) => n.toLocaleString(isEn ? 'en-US' : 'fr-FR');
      const taux = s.tauxResolution ?? 0;

      return {
        text: isEn
          ? `📊 **Madina — live city stats** (from API right now):\n\n🏙️ **${fmt(s.total)}** total reports\n✅ **${fmt(s.resolus)}** resolved (${taux}% rate)\n🔵 **${fmt(s.enCours)}** in progress\n🟡 **${fmt(s.enAttente)}** pending\n\nData pulled directly from our backend — no fakes! 🎯`
          : `📊 **Madina — statistiques en direct** (issues de l'API) :\n\n🏙️ **${fmt(s.total)}** signalements au total\n✅ **${fmt(s.resolus)}** résolus (taux : ${taux} %)\n🔵 **${fmt(s.enCours)}** en cours\n🟡 **${fmt(s.enAttente)}** en attente\n\nDonnées tirées directement du backend — 100 % réelles ! 🎯`,
        chips: isEn
          ? ['🗺️ See map', '🔧 Report issue', '📋 My reports']
          : ['🗺️ Voir la carte', '🔧 Signaler', '📋 Mes signalements'],
      };
    }

    // Fallback while API loads or offline
    return {
      text: isEn
        ? `📊 **Madina city stats** — fetching live data...\n\nOnce loaded I'll show you exact numbers (total reports, resolution rate, pending issues). Hang tight! ⏳`
        : `📊 **Statistiques Madina** — chargement des données en cours...\n\nUne fois chargées, je vous afficherai les chiffres exacts (total, taux de résolution, en attente). Un instant ! ⏳`,
      chips: isEn
        ? ['🗺️ See map', '🔧 Report issue']
        : ['🗺️ Voir la carte', '🔧 Signaler'],
    };
  }

  // ─── How it works reply ───────────────────────────────────────────────────
  private buildHowReply(isEn: boolean): BotReply {
    return {
      text: isEn
        ? `🤔 **How Madina works:**\n\n1️⃣ **Report** — Citizens file issues with photo + location\n2️⃣ **AI triage** — Our AI classifies, prioritises & assigns teams automatically\n3️⃣ **Action** — City teams get notified and dispatched\n4️⃣ **Resolve** — You get notified when fixed!\n\nThe whole loop takes minutes, not months.`
        : `🤔 **Comment fonctionne Madina :**\n\n1️⃣ **Signalez** — Les citoyens soumettent avec photo + localisation\n2️⃣ **Triage IA** — Notre IA classifie, priorise et assigne automatiquement\n3️⃣ **Action** — Les équipes de la ville sont notifiées\n4️⃣ **Résolution** — Vous êtes notifié quand c'est réglé !\n\nTout le cycle prend des minutes, pas des mois.`,
      chips: isEn
        ? ['🔧 Report now', '📊 Stats', '🗺️ Map']
        : ['🔧 Signaler', '📊 Stats', '🗺️ Carte'],
    };
  }

  // ─── Emergency reply ──────────────────────────────────────────────────────
  private buildEmergencyReply(isEn: boolean): BotReply {
    return {
      text: isEn
        ? `🚨 **EMERGENCY CONTACTS**\n\n🚒 Fire / Rescue: **198**\n🚑 SAMU (Medical): **190**\n👮 Police: **197**\n🏥 Civil Protection: **193**\n\n⚠️ For urban dangers (fallen pole, gas leak, flood), also file a report so our teams are dispatched!`
        : `🚨 **NUMÉROS D'URGENCE**\n\n🚒 Pompiers / Secours : **198**\n🚑 SAMU : **190**\n👮 Police : **197**\n🏥 Protection Civile : **193**\n\n⚠️ Pour les dangers urbains (poteau tombé, fuite de gaz, inondation), signalez également pour que nos équipes interviennent !`,
      chips: isEn
        ? ['🔧 File urgent report', '🗺️ Map']
        : ['🔧 Signalement urgent', '🗺️ Carte'],
    };
  }

  // ─── Points reply ─────────────────────────────────────────────────────────
  private buildPointsReply(isEn: boolean): BotReply {
    return {
      text: isEn
        ? `⭐ **Citizen points system:**\n\n+10 pts — Submit a report\n+5 pts — Report confirmed by community\n+20 pts — Report resolved\n+50 pts — First report of a new issue type\n\nClimb the leaderboard and earn badges! 🏅`
        : `⭐ **Système de points citoyens :**\n\n+10 pts — Soumettre un signalement\n+5 pts — Signalement confirmé par la communauté\n+20 pts — Signalement résolu\n+50 pts — Premier signalement d'un nouveau type\n\nGrimpez dans le classement et gagnez des badges ! 🏅`,
      chips: isEn
        ? ['🏆 Leaderboard', '🔧 Report to earn points']
        : ['🏆 Classement', '🔧 Signaler pour gagner des points'],
    };
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────
  private buildFallbackReply(isEn: boolean, raw: string): BotReply {
    const suggestions = isEn
      ? ['🔧 Report issue', '🌤️ Weather', '📊 Stats', '❓ How it works']
      : ['🔧 Signaler', '🌤️ Météo', '📊 Stats', '❓ Comment ça marche'];

    return {
      text: isEn
        ? `🤖 I'm not sure I understood that. Here are some things I can help with:`
        : `🤖 Je n'ai pas bien compris. Voici ce que je sais faire :`,
      chips: suggestions,
    };
  }

  // ─── Refresh real stats on demand ────────────────────────────────────────
  refreshStats(): void {
    this.sigSvc.getStats().subscribe({
      next: (s: Record<string, number>) => {
        const total   = s['total']   ?? 0;
        const resolus = s['resolus'] ?? 0;
        this.liveStats = {
          total,
          resolus,
          enCours:   s['enCours']   ?? 0,
          enAttente: s['enAttente'] ?? 0,
          tauxResolution: total > 0 ? Math.round((resolus / total) * 100) : 0,
        };
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ─── Navigation from chips ────────────────────────────────────────────────
  handleChipNavigation(chip: string): void {
    const lower = chip.toLowerCase();
    if (/carte|map/.test(lower))              this.router.navigate(['/']);
    if (/signaler|report now|go report/.test(lower)) this.router.navigate(['/signaler']);
    if (/mes signal|my report/.test(lower))   this.router.navigate(['/signaler/mes-signalements']);
    if (/classement|leaderboard/.test(lower)) this.router.navigate(['/user/leaderboard']);
    if (/connect|sign in/.test(lower))        this.router.navigate(['/auth/signin']);
    if (/compte|account/.test(lower))         this.router.navigate(['/auth/signup']);
    if (/accueil|home/.test(lower))           this.router.navigate(['/']);
  }

  // ─── Message helpers ──────────────────────────────────────────────────────
  private addUserMessage(text: string): void {
    this.messages.push({ from: 'user', text, time: new Date() });
    this.cdr.detectChanges();
    this.scrollBottom();
  }

  addBotMessage(text: string, chips?: string[]): void {
    this.messages.push({ from: 'bot', text, chips, time: new Date() });
    this.cdr.detectChanges();
    this.scrollBottom();
    this.animateLastBotMessage();
  }

  private showTyping(callback: () => void): void {
    this.typing = true;
    this.cdr.detectChanges();
    this.scrollBottom();

    const delay = 600 + Math.random() * 600;
    setTimeout(() => {
      this.typing = false;
      callback();
    }, delay);
  }

  private scrollBottom(): void {
    setTimeout(() => {
      const el = this.chatBodyRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  private animateLastBotMessage(): void {
    if (typeof gsap === 'undefined') return;
    setTimeout(() => {
      const items = document.querySelectorAll('.cb-msg--bot');
      const last  = items[items.length - 1];
      if (last) {
        gsap.fromTo(last,
          { opacity: 0, x: -12, scale: 0.96 },
          { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: 'back.out(1.4)' }
        );
      }
    }, 30);
  }

  private animateOpen(): void {
    if (typeof gsap === 'undefined') return;
    const panel = document.querySelector('.cb-panel');
    if (panel) {
      gsap.fromTo(panel,
        { opacity: 0, y: 24, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }
      );
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────
  private capitalise(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private getRoleLabel(): string {
    const map: Record<string, string> = {
      CHEF_EQUIPE:   'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain',
      MODERATEUR:    'Modérateur',
      ADMIN_VILLE:   'Admin',
    };
    return map[this.userRole] ?? this.userRole;
  }

  formatTime(d: Date): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // bold **text** → <strong>
  formatBold(text: string): string {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  get hasUnread(): boolean {
    return false; // placeholder, can wire to notification count
  }

  get fabTooltip(): string {
    const isEn = this.lang.current === 'en';
    if (this.weather?.level) return isEn ? `Weather alert active` : `Alerte météo active`;
    return isEn ? 'Chat with Madina' : 'Discuter avec Madina';
  }
}
