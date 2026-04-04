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
  langueActive: 'fr' | 'ar' | 'tn' | 'en' = 'fr';
  traductionLoading = false;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private fb: FormBuilder,
    private evenementService: EvenementService,
    private authService: AuthService,
    public sound: SoundService,
    private meteoService: MeteoService
  ) {
    const user = this.authService.getCurrentUserWithEmail();
    this.isAdmin = this.authService.isAdmin();

    this.inscriptionForm = this.fb.group({
      citoyenId: [user?.userId || ''],
      email:     [user?.email || ''],
      nom:       [user?.email?.split('@')[0] || '']
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.chargerEvenement(id);
    this.chargerSponsors(id);
    this.chargerInteresse(id);
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
    this.evenementService.getEvenementById(id).subscribe({
      next: (data) => { 
        this.evenement = data; 
        this.loading = false;
        this.startCountdown();                          
        this.chargerSimilaires(data.type, data.id!); 
        this.chargerMeteo(data);
       },
      error: () => { this.erreur = 'Événement introuvable'; this.loading = false; }
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
        this.erreur = '🔒 Vous devez être connecté pour vous inscrire à un événement.';
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
      // ← Forcer les valeurs avant envoi
      this.inscriptionForm.patchValue({
        citoyenId: user?.userId || '',
        email: user?.email || '',
        nom: user?.email?.split('@')[0] || 'Citoyen'
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
            this.erreur = '⚠️ Vous êtes déjà inscrit à cet événement !';
          } else {
            this.erreur = '❌ Erreur lors du paiement.';
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
              this.succes = '✅ Réservation confirmée ! Payez en espèces le jour J. Votre QR Code est ci-dessous.';
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
            this.erreur = '⚠️ Vous êtes déjà inscrit à cet événement !';
          } else if (erreurServeur?.includes('complet')) {
            this.erreur = '😔 Cet événement est complet, plus de places disponibles.';
          } else {
            this.erreur = '❌ Erreur lors de la réservation.';
          }
          this.inscriptionLoading = false;
          this.afficherChoixPaiement = false;
        }
      });
    }

  supprimerParticipant(participantId: number): void {
    if (!confirm('Désinscrire ce participant ?')) return;
    this.sound.click();       
    this.evenementService.supprimerParticipant(participantId).subscribe({
      next: () => {
        this.sound.success();  
        this.succes = '✅ Participant supprimé';
        this.chargerParticipants(this.evenement!.id!);
        this.chargerEvenement(this.evenement!.id!);
        setTimeout(() => this.succes = '', 3000);
      },
      error: () => this.erreur = 'Erreur lors de la suppression'
    });
  }

  confirmerPresence(participantId: number): void {
    this.sound.click();
    this.evenementService.confirmerPresence(participantId).subscribe({
      next: () => {
        this.sound.success();  
        this.succes = '✅ Présence confirmée';
        this.chargerParticipants(this.evenement!.id!);
        setTimeout(() => this.succes = '', 3000);
      },
      error: () => this.erreur = 'Erreur lors de la confirmation'
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
      next: (ev) => { this.evenement = ev; this.succes = '⚠️ Événement annulé'; },
      error: () => this.erreur = 'Erreur lors de l\'annulation'
    });
  }

  publier(): void {
    if (!this.evenement?.id) return;
    this.sound.click();
    this.evenementService.publierEvenement(this.evenement.id).subscribe({
      next: (ev) => { 
        this.sound.success();
        this.evenement = ev; this.succes = '✅ Événement publié !'; },
      error: () => this.erreur = 'Erreur lors de la publication'
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
  if (!user?.userId) { this.showToast('🔒 Connectez-vous pour marquer votre intérêt', 'error'); return; }
  this.sound.toggle2(!this.interesse);
  this.interesseLoading = true;
  this.evenementService.toggleInteret(user.userId, this.evenement.id).subscribe({
    next: (res) => {
      this.interesse = res.interesse;
      this.interesseLoading = false;
      this.showToast(res.interesse ? '❤️ Ajouté à vos intérêts !' : '💔 Retiré de vos intérêts', 'success');
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
    return encodeURIComponent(window.location.href);
  }

  get shareText(): string {
    return encodeURIComponent(
      `🎉 ${this.evenement?.titre} — ${this.evenement?.lieu} | CityVoice`
    );
  }

  get whatsappText(): string {
    const titre    = this.evenement?.titre || '';
    const lieu     = this.evenement?.lieu || '';
    const date     = this.evenement?.dateDebut 
      ? new Date(this.evenement.dateDebut).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : '';
    const prix     = this.evenement?.estPayant 
      ? `💰 Prix : ${this.evenement.prix} TND` 
      : '✅ Entrée gratuite';
    const lien     = window.location.href;

    return encodeURIComponent(
  `🎉 *${titre}*

  📍 Lieu : ${lieu}
  📅 Date : ${date}
  ${prix}

  👉 Plus d'infos et inscription : ${lien}

  _Partagé via CityVoice 🌍_`
    );
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
    if (!ev.latitude || !ev.longitude || !ev.dateDebut) return;

    // Vérifier si la date est dans les 16 prochains jours
    const now = new Date();
    const eventDate = new Date(ev.dateDebut);
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || diffDays > 16) return; // ← API limite à 16 jours

    this.meteoLoading = true;
    this.meteoService.getMeteo(ev.latitude, ev.longitude, ev.dateDebut).subscribe({
      next: (data) => {
        this.meteo = data;
        this.meteoLoading = false;
      },
      error: () => { this.meteoLoading = false; }
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
    this.langueActive = langue as 'ar' | 'tn' | 'en';

    const langueParam =
      langue === 'ar' ? 'arabe'   :
      langue === 'tn' ? 'tunisien':
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
  retour(): void {
    this.sound.nav();  
    if (this.isAdmin) {
      this.router.navigate(['/admin/evenements']);
    } else {
      this.router.navigate(['/evenements']);
    }
  }
}