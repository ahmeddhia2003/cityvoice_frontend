import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Evenement } from '../../models/evenement.model';
import { Sponsor } from '../../models/sponsor.model';
import { Participant } from '../../models/participant.model';
import { EvenementService } from '../../services/evenement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SoundService } from '../../../../core/services/sound.service';
import { MeteoService, MeteoData } from '../../../../core/services/meteo.service';
import { GoogleCalendarService } from '../../../../core/services/google-calendar.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-evenement-detail',
  templateUrl: './evenement-detail.component.html',
  styleUrls: ['./evenement-detail.component.css']
})
export class EvenementDetailComponent implements OnInit, OnDestroy {

  evenement: Evenement | null = null;
  sponsors: Sponsor[] = [];
  loading = false;
  inscriptionLoading = false;
  erreur = '';
  succes = '';
  inscriptionForm: FormGroup;
  budgetSuggerePred: number = 5000;
  // QR Code
  participantInscrit: Participant | null = null;
  inscriptionReussie = false;

  // Admin
  isAdmin = false;
  participants: Participant[] = [];
  participantsLoading = false;
  afficherChoixPaiement = false;
  //ameliorations
  countdown = '';
  private countdownInterval: any;
  interesse = false;
  private interesseLoading = false;
  toast = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimeout: any;
  evenementsSimilaires: Evenement[] = [];
  //météo
  meteo: MeteoData | null = null;
  meteoLoading = false;
  //traduction 
  descriptionTraduite: string | null = null;
  langueActive: 'fr' | 'ar' | 'en' = 'fr';
  traductionLoading = false;
  
  shareLoading = false;
  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private fb: FormBuilder,
    private evenementService: EvenementService,
    private authService: AuthService,
    public sound: SoundService,
    private meteoService: MeteoService,
    private googleCalendarService: GoogleCalendarService,
    public i18n: I18nService
  ) {
    const user = this.authService.getCurrentUserWithEmail();
    this.isAdmin = this.authService.isAdmin();

    this.inscriptionForm = this.fb.group({
      citoyenId: [user?.userId || ''],
      email:     [user?.email || ''],
      nom:       [user?.email?.split('@')[0] || ''],
      telCitoyen: [''] 
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.chargerEvenement(id);
    this.chargerSponsors(id);
    this.chargerInteresse(id);
    this.verifierInscription(id); 
    if (this.isAdmin) {
      this.chargerParticipants(id);
    }
    // ← Vérifier si on arrive depuis un paiement Stripe
    const participantId = Number(this.route.snapshot.queryParams['participantId']);
    if (participantId) {
      this.chargerParticipantInscrit(participantId);
    }
  }
  ngOnDestroy(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  chargerEvenement(id: number): void {
    this.loading = true;
    this.shareTexts = {};
    this.evenementService.getEvenementById(id).subscribe({
      next: (data) => { 
        this.evenement = data; 
        this.loading = false;
        this.updateMetaTags();
        this.startCountdown();                          
        this.chargerSimilaires(data.type, data.id!); 
        this.chargerMeteo(data);
        this.prechargerTextes(data.id!);
       },
      error: () => { this.erreur = this.i18n.t('adm.ev.err.load'); this.loading = false; }
    });
  }
  chargerSponsors(id: number): void {
    this.evenementService.getSponsors(id).subscribe({
      next: (data) => this.sponsors = data,
      error: () => {}
    });
  }

  chargerParticipants(id: number): void {
    this.participantsLoading = true;
    this.evenementService.getParticipants(id).subscribe({
      next: (data) => { this.participants = data; this.participantsLoading = false; },
      error: () => this.participantsLoading = false
    });
  }

  /*inscrire(): void {
    if (!this.authService.isLoggedIn()) {
      this.erreur = '🔒 Vous devez être connecté pour vous inscrire à un événement.';
      setTimeout(() => this.router.navigate(['/auth/signin']), 5000);
      return;
    }

    if (this.inscriptionForm.invalid || !this.evenement?.id) return;
    this.inscriptionLoading = true;

    this.evenementService.inscrireParticipant(this.evenement.id, this.inscriptionForm.value)
      .subscribe({
        next: (res: Participant) => {
          console.log("DEBUG: Réponse du serveur reçue !", res);
          console.log("DEBUG: QR Token récupéré ->", res.qrToken);

          this.participantInscrit = res;
          this.inscriptionReussie = true;
          this.succes = '✅ Inscription confirmée ! Votre QR Code est prêt ci-dessous.';
          this.inscriptionLoading = false;
          this.inscriptionForm.reset();
          this.chargerEvenement(this.evenement!.id!);
        },
        error: (err) => {
          const erreurServeur = err.error?.erreur || err.error?.message;
          if (erreurServeur?.includes('déjà inscrit')) {
            this.erreur = '⚠️ Vous êtes déjà inscrit à cet événement !';
          } else if (erreurServeur?.includes('complet')) {
            this.erreur = '😔 Cet événement est complet, plus de places disponibles.';
          } else {
            this.erreur = '❌ Erreur lors de l\'inscription. Veuillez réessayer.';
          }
          this.inscriptionLoading = false;
        }
      });
  }*/
    inscrire(): void {
      if (!this.authService.isLoggedIn()) {
        this.sound.click();
        this.erreur = this.i18n.t('ev.detail.err.login');
        setTimeout(() => this.router.navigate(['/auth/signin']), 2000);
        return;
      }

      /*if (this.inscriptionForm.invalid ){
         this.inscriptionForm.markAllAsTouched();
         return;
      } */
      if (!this.evenement?.id) return;
      // Si événement payant → afficher choix paiement
      if (this.evenement.estPayant) {
        this.sound.click(); 
        this.afficherChoixPaiement = true;
        return;
      }

      // Si gratuit → inscription directe
      this.inscrireGratuit();
    }

    inscrireGratuit(): void {
      const user = this.authService.getCurrentUserWithEmail();
      console.log('Form value:', this.inscriptionForm.value);
      // ← Forcer les valeurs avant envoi
      this.inscriptionForm.patchValue({
        citoyenId: user?.userId || '',
        email: user?.email || '',
        nom: user?.email?.split('@')[0] || 'Citoyen'
        //telCitoyen: ''
      });

      console.log('Form value after patch:', this.inscriptionForm.value);
      this.sound.click(); 
      this.inscriptionLoading = true;
      this.evenementService.inscrireParticipant(
        this.evenement!.id!, this.inscriptionForm.value
      ).subscribe({
        next: (res: Participant) => {
          this.sound.success(); 
          console.log("DEBUG: Réponse du serveur reçue !", res);
          console.log("DEBUG: QR Token récupéré ->", res.qrToken);
          this.participantInscrit = res;
          this.inscriptionReussie = true;
          this.succes = this.i18n.t('ev.detail.succes.inscription');
          this.inscriptionLoading = false;
          this.inscriptionForm.reset();
          this.chargerEvenement(this.evenement!.id!);
        },
        error: (err) => {
          const erreurServeur = err.error?.erreur || err.error?.message;
          if (erreurServeur?.includes('déjà inscrit')) {
            this.erreur = this.i18n.t('ev.detail.err.deja');
          } else if (erreurServeur?.includes('complet')) {
            this.erreur = this.i18n.t('ev.detail.err.complet');
          } else {
            this.erreur = this.i18n.t('ev.detail.err.inscription');
          }
          this.inscriptionLoading = false;
        }
      });
    }

    payerEnLigne(): void {
      this.sound.click(); 
      this.inscriptionLoading = true;
      this.evenementService.creerSessionPaiement(
        this.evenement!.id!, this.inscriptionForm.value
      ).subscribe({
        next: (res) => {
          this.inscriptionLoading = false;
          window.location.href = res.url; // ← redirect Stripe
        },
        error: (err) => {
          const erreurServeur = err.error?.erreur || err.error?.message;
          if (erreurServeur?.includes('déjà inscrit')) {
            this.erreur = this.i18n.t('ev.detail.err.deja')
          } else {
            this.erreur = this.i18n.t('ev.detail.err.paiement');
          }
          this.inscriptionLoading = false;
          this.afficherChoixPaiement = false;
        }
      });
    }

    payerEspeces(): void {
      this.sound.click();
      this.inscriptionLoading = true;
      this.evenementService.inscrireParticipant(
        this.evenement!.id!, this.inscriptionForm.value
      ).subscribe({
        next: (res: Participant) => {
          this.evenementService.reserverEspeces(res.id!).subscribe({
            next: () => {
              this.sound.success();  
              this.participantInscrit = res;
              this.inscriptionReussie = true;
              this.succes = this.i18n.t('ev.detail.succes.especes');
              this.inscriptionLoading = false;
              this.afficherChoixPaiement = false;
              this.inscriptionForm.reset();
              this.chargerEvenement(this.evenement!.id!);
            }
          });
        },
        error: (err) => {
          const erreurServeur = err.error?.erreur || err.error?.message;
          if (erreurServeur?.includes('déjà inscrit')) {
            this.erreur = this.i18n.t('ev.detail.err.deja');
          } else if (erreurServeur?.includes('complet')) {
            this.erreur = this.i18n.t('ev.detail.err.complet');
          } else {
            this.erreur = this.i18n.t('ev.detail.err.reservation');
          }
          this.inscriptionLoading = false;
          this.afficherChoixPaiement = false;
        }
      });
    }

  supprimerParticipant(participantId: number): void {
    if (!confirm(this.i18n.t('ev.detail.confirm.desinscrire'))) return;
    this.sound.click();       
    this.evenementService.supprimerParticipant(participantId).subscribe({
      next: () => {
        this.sound.success();  
        this.succes = this.i18n.t('ev.detail.succes.suppr.participant');
        this.chargerParticipants(this.evenement!.id!);
        this.chargerEvenement(this.evenement!.id!);
        setTimeout(() => this.succes = '', 3000);
      },
      error: () => this.erreur = this.i18n.t('ev.detail.err.suppr')
    });
  }

  confirmerPresence(participantId: number): void {
    this.sound.click();
    this.evenementService.confirmerPresence(participantId).subscribe({
      next: () => {
        this.sound.success();  
        this.succes = this.i18n.t('ev.detail.succes.presence');
        this.chargerParticipants(this.evenement!.id!);
        setTimeout(() => this.succes = '', 3000);
      },
      error: () => this.erreur = this.i18n.t('ev.detail.err.presence')
    });
  }

  modifierEvenement(): void {
    this.sound.nav(); 
    this.router.navigate(['/admin/evenements', this.evenement!.id, 'edit']);
  }

  annuler(): void {
    if (!this.evenement?.id) return;
    this.sound.click();
    this.evenementService.annulerEvenement(this.evenement.id).subscribe({
      next: (ev) => { this.evenement = ev; this.succes = this.i18n.t('adm.ev.succes.cancel'); },
      error: () => this.erreur = this.i18n.t('adm.ev.err.cancel')
    });
  }

  publier(): void {
    if (!this.evenement?.id) return;
    this.sound.click();
    this.evenementService.publierEvenement(this.evenement.id).subscribe({
      next: (ev) => { 
        this.sound.success();
        this.evenement = ev; this.succes = this.i18n.t('adm.ev.succes.publish'); },
      error: () => this.erreur = this.i18n.t('adm.ev.err.publish')
    });
  }
  // ─── Countdown ────────────────────────────────────────
startCountdown(): void {
  if (this.countdownInterval) clearInterval(this.countdownInterval);
  this.updateCountdown();
  this.countdownInterval = setInterval(() => this.updateCountdown(), 1000);
}

updateCountdown(): void {
  if (!this.evenement?.dateDebut) return;
  const now = new Date().getTime();
  const eventDate = new Date(this.evenement.dateDebut).getTime();
  const diff = eventDate - now;
  if (diff <= 0) { this.countdown = 'En cours'; clearInterval(this.countdownInterval); return; }
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0)       this.countdown = `${days}j ${hours}h ${minutes}m`;
  else if (hours > 0) this.countdown = `${hours}h ${minutes}m ${seconds}s`;
  else                this.countdown = `${minutes}m ${seconds}s`;
}

// ─── Toast ────────────────────────────────────────────
showToast(message: string, type: 'success' | 'error' = 'success'): void {
  this.toast = message;
  this.toastType = type;
  if (this.toastTimeout) clearTimeout(this.toastTimeout);
  this.toastTimeout = setTimeout(() => this.toast = '', 3500);
}

// ─── Intéressé ────────────────────────────────────────
chargerInteresse(evenementId: number): void {
  const user = this.authService.getCurrentUserWithEmail();
  if (!user?.userId) return;
  this.evenementService.getInterets(user.userId).subscribe({
    next: (ids) => this.interesse = ids.includes(evenementId),
    error: () => {}
  });
}

toggleInteresse(): void {
  if (this.interesseLoading || !this.evenement?.id) return;
  const user = this.authService.getCurrentUserWithEmail();
  if (!user?.userId) { this.showToast(this.i18n.t('ev.detail.err.login.interet'), 'error'); return; }
  this.sound.toggle2(!this.interesse);
  this.interesseLoading = true;
  this.evenementService.toggleInteret(user.userId, this.evenement.id).subscribe({
    next: (res) => {
      this.interesse = res.interesse;
      this.interesseLoading = false;
      this.showToast(res.interesse ? this.i18n.t('ev.detail.interet.ajoute'): this.i18n.t('ev.detail.interet.retire'), 'success');
    },
    error: () => { this.interesseLoading = false; }
  });
}

// ─── Événements similaires ────────────────────────────
chargerSimilaires(type: string, currentId: number): void {
  this.evenementService.getEvenements().subscribe({
    next: (data) => {
      this.evenementsSimilaires = data
        .filter(e => e.type === type && e.id !== currentId)
        .slice(0, 3);
    },
    error: () => {}
  });
}

// ─── getTypePill ──────────────────────────────────────
getTypePill(type: string): string {
  const map: any = {
    SEMINAIRE: 'pill-navy',  EDUCATION: 'pill-teal',
    RECYCLAGE: 'pill-teal',  BENEVOLE:  'pill-gold',
    PAYANT:    'pill-coral', AUTRE:     'pill-navy'
  };
  return map[type] || 'pill-navy';
}
  getCapacitePercent(): number {
    if (!this.evenement?.capaciteMax) return 0;
    return Math.min(((this.evenement.nbInscrits || 0) / this.evenement.capaciteMax) * 100, 100);
  }

  getPlacesRestantes(): number {
    if (!this.evenement?.capaciteMax) return 0;
    return this.evenement.capaciteMax - (this.evenement.nbInscrits || 0);
  }

  getCapaciteColor(): string {
    const p = this.getCapacitePercent();
    if (p >= 90) return 'var(--coral)';
    if (p >= 60) return 'var(--gold)';
    return 'var(--teal)';
  }

  getStatutClass(statut: string): string {
    const map: any = {
      PUBLIE:    'badge-publie',
      BROUILLON: 'badge-brouillon',
      ANNULE:    'badge-annule',
      TERMINE:   'badge-termine'
    };
    return map[statut] || '';
  }

  getNiveauClass(niveau: string): string {
    const map: any = {
      PLATINE: 'niveau-platine',
      OR:      'niveau-or',
      ARGENT:  'niveau-argent',
      BRONZE:  'niveau-bronze'
    };
    return map[niveau] || 'niveau-bronze';
  }

  get currentUrl(): string {
    return window.location.href;
  }

  get shareText(): string {
    return encodeURIComponent(
      `🎉 ${this.evenement?.titre} — ${this.evenement?.lieu} | CityVoice`
    );
  }

  get whatsappText(): string {
    const titre = this.evenement?.titre || '';
    const lieu  = this.evenement?.lieu || '';
    const date  = this.evenement?.dateDebut 
      ? new Date(this.evenement.dateDebut).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }) : '';
    const prix  = this.evenement?.estPayant 
      ? `💰 Prix : ${this.evenement.prix} TND` 
      : '✅ Entrée gratuite';
    const lien  = window.location.href;

    const message = 
      `🎉 *${titre}*\n\n` +
      `📍 Lieu : ${lieu}\n` +
      `📅 Date : ${date}\n` +
      `${prix}\n\n` +
      `👉 Inscription : ${lien}\n\n` +
      `_Partagé via CityVoice 🌍_`;

    return encodeURIComponent(message);
  }

  get twitterText(): string {
    const titre = this.evenement?.titre || '';
    const lieu  = this.evenement?.lieu || '';
    const lien  = window.location.href;

    return encodeURIComponent(
      `🎉 ${titre} | 📍 ${lieu} — Inscrivez-vous maintenant ! ${lien} #CityVoice #Evenement #Tunis`
    );
  }

  copierLien(): void {
    this.sound.toggle2(true);    
    navigator.clipboard.writeText(window.location.href).then(() => {
      this.succes = '🔗 Lien copié dans le presse-papiers !';
      setTimeout(() => this.succes = '', 3000);
    });
  }

  private defaultImages: { [key: string]: string } = {
  SEMINAIRE: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
  EDUCATION: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
  RECYCLAGE: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80',
  BENEVOLE:  'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80',
  PAYANT:    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  AUTRE:     'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80'
  };

  getImageDefaut(type: string): string {
    return this.defaultImages[type] ||
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80';
  } 
  // Météo
  chargerMeteo(ev: Evenement): void {
    console.log('🌤 chargerMeteo appelé:', ev.latitude, ev.longitude, ev.dateDebut);
    if (!ev.latitude || !ev.longitude || !ev.dateDebut) {
      console.log('❌ Données manquantes');
      return;
    }

    const now = new Date();
    const eventDate = new Date(ev.dateDebut);
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log('📅 diffDays:', diffDays);

    if (diffDays < 0 || diffDays > 16) {
      console.log('❌ Date hors plage:', diffDays);
      return;
    }

    this.meteoLoading = true;
    this.meteoService.getMeteo(ev.latitude, ev.longitude, ev.dateDebut).subscribe({
      next: (data) => {
        console.log('✅ Météo reçue:', data);
        this.meteo = data;
        this.meteoLoading = false;
      },
      error: (err) => {
        console.log('❌ Erreur météo:', err);
        this.meteoLoading = false;
      }
    });
  }
  chargerParticipantInscrit(participantId: number): void {
    this.evenementService.getParticipants(
      Number(this.route.snapshot.paramMap.get('id'))
    ).subscribe({
      next: (participants) => {
        const p = participants.find(p => p.id === participantId);
        if (p) {
          this.participantInscrit = p;
          this.inscriptionReussie = true;
          this.showToast('✅ Paiement confirmé ! Votre QR Code est prêt.', 'success');
        }
      },
      error: () => {}
    });
  }
  // traduction
  traduire(langue: string): void {
    if (langue === 'fr') {
      this.descriptionTraduite = null;
      this.langueActive = 'fr';
      return;
    }

    if (!this.evenement?.description) return;

    this.traductionLoading = true;
    this.langueActive = langue as 'ar' | 'en';

    // ✅ Mapping correct vers le backend
    const langueParam =
      langue === 'ar' ? 'arabe'   :
      langue === 'en' ? 'anglais' : 'arabe';

    this.evenementService.traduire(
      this.evenement.description,
      langueParam
    ).subscribe({
      next: (res) => {
        this.descriptionTraduite = res.texteTraduire;
        this.traductionLoading = false;
      },
      error: () => {
        this.traductionLoading = false;
      }
    });
  }

  getDescription(): string {
    return this.descriptionTraduite ||
          this.evenement?.description || '';
  }
  
  async ajouterAuCalendar(): Promise<void> {
    if (!this.evenement) return;
    this.sound.click();
    
    const eventId = await this.googleCalendarService.ajouterEvenement(this.evenement);
    if (eventId) {
      this.showToast('✅ Ajouté à Google Calendar !', 'success');
    } else {
      this.showToast('❌ Erreur Google Calendar', 'error');
    }
  }
  verifierInscription(evenementId: number): void {
    const user = this.authService.getCurrentUserWithEmail();
    if (!user?.userId || this.isAdmin) return;

    // Chercher si le user est déjà inscrit
    this.evenementService.getParticipants(evenementId).subscribe({
      next: (participants) => {
        const p = participants.find(p => p.citoyenId === user.userId);
        if (p) {
          this.participantInscrit = p;
          this.inscriptionReussie = true;
        }
      },
      error: () => {}
    });
  }
  getStatutLabel(statut: string): string {
    const map: any = {
    'PUBLIE':    this.i18n.t('adm.ev.statut.publie'),
    'BROUILLON': this.i18n.t('adm.ev.statut.brouillon'),
    'ANNULE':    this.i18n.t('adm.ev.statut.annule'),
    'TERMINE':   this.i18n.t('adm.ev.statut.termine'),
  };
  return map[statut] || statut;
  }

  getTypeLabel(type: string): string {
    const map: any = {
    'BENEVOLE':  this.i18n.t('adm.ev.type.benevole'),
    'EDUCATION': this.i18n.t('adm.ev.type.education'),
    'RECYCLAGE': this.i18n.t('adm.ev.type.recyclage'),
    'SEMINAIRE': this.i18n.t('adm.ev.type.seminaire'),
    'PAYANT':    this.i18n.t('adm.ev.type.payant'),
    };
    return map[type] || type;
  }
  getTypeLieuLabel(typeLieu: string): string {
    const map: any = {
      'HOTEL':        { fr: '🏨 Hôtel',              en: '🏨 Hotel' },
      'SALLE':        { fr: '🏛️ Salle de conférence', en: '🏛️ Conference room' },
      'PLEIN_AIR':    { fr: '🌳 Plein air',           en: '🌳 Outdoor' },
      'UNIVERSITE':   { fr: '🎓 Université',          en: '🎓 University' },
      'MUNICIPALITE': { fr: '🏛️ Municipalité',        en: '🏛️ Municipality' },
    };
    return map[typeLieu]?.[this.i18n.lang] || typeLieu;  
  }

  getZoneLabel(zone: string): string {
    const map: any = {
      'LAC':           { fr: '🏙️ Lac / Les Berges du Lac', en: '🏙️ Lac / Lake Shore' },
      'MARSA':         { fr: '🌊 La Marsa / Gammarth',     en: '🌊 La Marsa / Gammarth' },
      'CENTRE_VILLE':  { fr: '🏛️ Centre ville Tunis',      en: '🏛️ Tunis City Center' },
      'BANLIEUE':      { fr: '🏘️ Banlieue',                en: '🏘️ Suburbs' },
      'SFAX_CENTRE':   { fr: '🏙️ Sfax Centre',             en: '🏙️ Sfax Center' },
      'SOUSSE_CENTRE': { fr: '🏖️ Sousse Centre',           en: '🏖️ Sousse Center' },
      'AUTRE':         { fr: '📍 Autre',                   en: '📍 Other' },
    };
    return map[zone]?.[this.i18n.lang] || zone;  // ← this.i18n.lang
  }
  onBudgetPredit(budget: number): void {
    this.budgetSuggerePred = budget;  // ✅ passe au composant sponsor
  }
  allerLiveBroadcast(): void {
    this.router.navigate(['/evenements', this.evenement!.id, 'live', 'broadcast']);
  }

  allerLiveWatch(): void {
    this.router.navigate(['/evenements', this.evenement!.id, 'live', 'watch']);
  }
  // ── Open Graph meta tags ──────────────────────────
  updateMetaTags(): void {
    if (!this.evenement) return;

    const title       = this.evenement.titre;
    const description = this.evenement.description?.substring(0, 200) || '';
    const image       = this.evenement.imageUrl || this.getImageDefaut(this.evenement.type);
    const prix        = this.evenement.estPayant
      ? `💰 ${this.evenement.prix} TND` : '🎟️ Gratuit';
    const date        = new Date(this.evenement.dateDebut!)
      .toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric',
        month: 'long', year: 'numeric'
      });

    this.setMeta('og:title',       `${title} | CityVoice`);
    this.setMeta('og:description', `📅 ${date} | 📍 ${this.evenement.lieu} | ${prix} — ${description}`);
    this.setMeta('og:image',       image);
    this.setMeta('og:url',         this.currentUrl);
    this.setMeta('og:type',        'event');
    this.setMeta('twitter:card',   'summary_large_image');
    this.setMeta('twitter:title',  `${title} | CityVoice`);
    this.setMeta('twitter:image',  image);

    document.title = `${title} | CityVoice`;
  }

  private setMeta(name: string, content: string): void {
    let el = document.querySelector(`meta[property="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  // ── Textes partage Gemma2 ─────────────────────────
  shareTexts: Record<string, string> = {};

  genererTextePartage(plateforme: string): void {
    
  }

  partagerFacebook(): void {
    const url = encodeURIComponent(window.location.href); // ← encoder ici
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      '_blank'
    );
  }
  partagerWhatsapp(): void {
    const lien  = window.location.href;
    const titre = this.evenement?.titre || '';
    const lieu  = this.evenement?.lieu  || '';
    const date  = this.evenement?.dateDebut
      ? new Date(this.evenement.dateDebut).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric'
        }) : '';
    const prix = this.evenement?.estPayant
      ? `${this.evenement.prix} TND` : 'Gratuit';

    // Texte Gemma2 si disponible
    const texteIA = this.shareTexts['whatsapp'];

    const text = texteIA
      ? `${texteIA}\n\n${lien}`
      : `*${titre}*\n\nLieu: ${lieu}\nDate: ${date}\nPrix: ${prix}\n\nInscription: ${lien}\n\nPartage via CityVoice`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  }

  
  partagerLinkedin(): void {
    const url   = encodeURIComponent(window.location.href);
    const titre = encodeURIComponent(this.evenement?.titre || '');
    const texteIA = this.shareTexts['linkedin'] || '';
    const summary = encodeURIComponent(texteIA);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${titre}&summary=${summary}`,
      '_blank'
    );
  }

  partagerTwitter(): void {
    const text = this.shareTexts['twitter'] ||
      `🎉 ${this.evenement?.titre} | 📍 ${this.evenement?.lieu} #CityVoice`;
    const encoded = encodeURIComponent(text + ' ' + window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank');
  }

  prechargerTextes(id: number): void {
    this.shareLoading = true;
    const plateformes = ['whatsapp', 'twitter', 'facebook', 'linkedin'];
    
    // ✅ Séquentiel au lieu de parallèle
    this.chargerTexteSequentiel(id, plateformes, 0);
  }

  private chargerTexteSequentiel(
    id: number, 
    plateformes: string[], 
    index: number
  ): void {
    if (index >= plateformes.length) {
      this.shareLoading = false;
      return;
    }

    const plateforme = plateformes[index];
    this.evenementService.getPostSocial(id, plateforme).subscribe({
      next: (r: any) => {
        this.shareTexts[plateforme] = r.post;
        console.log(`✅ Texte ${plateforme} chargé`);
        // ← Passer au suivant
        this.chargerTexteSequentiel(id, plateformes, index + 1);
      },
      error: () => {
        console.warn(`⚠️ Texte ${plateforme} échoué — skip`);
        // ← Continuer même si erreur
        this.chargerTexteSequentiel(id, plateformes, index + 1);
      }
    });
  }
  retour(): void {
    this.sound.nav();  
    if (this.isAdmin) {
      this.router.navigate(['/admin/evenements']);
    } else {
      this.router.navigate(['/evenements']);
    }
  }
}