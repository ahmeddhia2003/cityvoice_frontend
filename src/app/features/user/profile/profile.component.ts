import { Component, OnInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserDto, TrustInfo } from '../../../core/services/user.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

declare const gsap: any;

// ============================================
// VALIDATEUR PERSONNALISÉ
// ============================================
function passwordMatchValidator(g: AbstractControl): ValidationErrors | null {
  const p = g.get('newPassword')?.value;
  const c = g.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {

  // ============================================
  // HÔTES (HOST LISTENERS)
  // ============================================
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showCivicCard) {
      this.closeCivicCard();
    }
  }

  // ============================================
  // PROPRIÉTÉS PRINCIPALES
  // ============================================
  user: UserDto | null = null;
  loading = true;
  activeTab: 'info' | 'security' | 'activity' = 'info';

  // Formulaires
  infoForm!: FormGroup;
  pwdForm!: FormGroup;

  // États de sauvegarde
  savingInfo = false;
  savingPwd = false;

  // Photo
  photoPreview: string | null = null;
  photoOk = false;
  photoHover = false;
  photoChecking = false;
  photoError = '';

  // Notifications
  toast = false;
  toastMsg = '';
  toastType: 'success' | 'error' = 'success';

  // IA
  aiSuggestion: string = '';
  aiLoading: boolean = false;
  showAiSuggestion: boolean = false;

  // Civic Card
  showCivicCard = false;
  civicCardBadges: any[] = [];
  civicCardLoading = false;

  // Agent status
  selectedAgentStatus = '';
  savingAgentStatus = false;

  // Constantes
  readonly gouvernorats = [
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
    'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba',
    'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
    'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
  ];

  readonly agentStatusOptions = [
    { key: 'DISPONIBLE', label: 'Disponible', color: '#0D9B76', dot: '🟢' },
    { key: 'OCCUPE', label: 'Occupé', color: '#C9973E', dot: '🟡' },
    { key: 'EN_INTERVENTION', label: 'En intervention', color: '#E8532A', dot: '🔴' },
    { key: 'HORS_LIGNE', label: 'Hors ligne', color: '#9CA3AF', dot: '⚫' },
  ];

  // ============================================
  // CONSTRUCTEUR & LIFECYCLE
  // ============================================
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadUser();
  }

  // ============================================
  // INITIALISATION DES FORMULAIRES
  // ============================================
  private initForms(): void {
    this.infoForm = this.fb.group({
      nom: ['', Validators.required],
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      telephone: ['', [Validators.pattern(/^[0-9+\s]{8,15}$/)]],
      gouvernorat: [''],
      ville: [''],
      codePostal: ['', Validators.pattern(/^[0-9]{4}$/)],
    });

    this.pwdForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    }, { validators: passwordMatchValidator });
  }

  // ============================================
  // CHARGEMENT DES DONNÉES UTILISATEUR
  // ============================================
  loadUser(): void {
    const auth = this.authService.getCurrentUser();
    if (!auth?.userId) return;

    this.userService.getById(auth.userId).subscribe({
      next: (u) => {
        this.user           = u;
        this.loading        = false;
        this.photoPreview   = u.photo || null;
        this.photoError     = '';
        this.whatsappNotifs = u.whatsappNotifs ?? false;
        this.smsNotifs      = u.smsNotifs      ?? false;
        this.selectedAgentStatus = u.agentStatus || 'DISPONIBLE';
        this.infoForm.patchValue({
          nom: u.nom,
          email: u.email,
          telephone: u.telephone || '',
          gouvernorat: u.gouvernorat || '',
          ville: u.ville || '',
          codePostal: u.codePostal || '',
        });
      },
      error: () => { this.loading = false; }
    });
  }

  // ============================================
  // NAVIGATION ENTRE ONGLETS
  // ============================================
  setTab(tab: 'info' | 'security' | 'activity'): void {
    this.activeTab = tab;
  }

  // ============================================
  // GESTION DE LA PHOTO (MODÉRATION EN TEMPS RÉEL)
  // ============================================
  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Image trop lourde (max 5 Mo)', 'error');
      return;
    }

    this.compressImage(file, 200, 0.7).then(b64 => {
      const previousPhoto = this.photoPreview;
      this.photoPreview = b64;
      this.photoChecking = true;
      this.photoError = '';
      this.photoOk = false;

      const startTime = Date.now();

      this.authService.moderatePhoto(b64).subscribe({
        next: (res) => {
          const elapsed = Date.now() - startTime;
          const delay = Math.max(800 - elapsed, 0);

          setTimeout(() => {
            this.photoChecking = false;
            if (!res.safe) {
              this.photoError = res.reason || 'Photo inappropriée pour la plateforme';
              this.photoPreview = previousPhoto;
              this.photoOk = false;
              this.showToast(res.reason || 'Photo refusée ❌', 'error');
            } else {
              this.photoOk = true;
              this.showToast('Photo validée ✓', 'success');
            }
          }, delay);
        },
        error: () => {
          const elapsed = Date.now() - startTime;
          setTimeout(() => {
            this.photoChecking = false;
            this.photoOk = true; // fail open
          }, Math.max(800 - elapsed, 0));
        }
      });
    });
  }

  private compressImage(file: File, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > h) {
          if (w > maxSize) { h = h * maxSize / w; w = maxSize; }
        } else {
          if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
        }

        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = url;
    });
  }

  removePhoto(): void {
    this.photoPreview = null;
    this.photoError = '';
    this.photoOk = false;
    if (!this.user) return;

    this.userService.update(this.user.id, { photo: '' }).subscribe({
      next: () => {
        this.authService.refreshAuthState();
        this.showToast('Photo supprimée', 'success');
      },
      error: () => this.showToast('Erreur suppression photo', 'error')
    });
  }

  // ============================================
  // SAUVEGARDE DES INFORMATIONS
  // ============================================
  saveInfo(): void {
    if (this.infoForm.invalid || !this.user) return;
    if (this.photoError) {
      this.showToast('Corrigez la photo avant de sauvegarder', 'error');
      return;
    }
    if (this.photoChecking) {
      this.showToast('Attendez la vérification de la photo…', 'error');
      return;
    }

    this.savingInfo = true;
    const formValues = this.infoForm.getRawValue();

    // Vérification du nom avant sauvegarde
    const nom = formValues.nom?.trim() ?? '';
    this.authService.screenName(nom).subscribe({
      next: (result) => {
        if (!result.appropriate) {
          this.savingInfo = false;
          this.showToast(result.reason ?? 'Nom inapproprié pour la plateforme ❌', 'error');
          return;
        }
        this.doSaveInfo(formValues);
      },
      error: () => this.doSaveInfo(formValues) // fail open
    });
  }

  private doSaveInfo(formValues: any): void {
    if (!this.user) return;

    const payload = {
      nom: formValues.nom,
      telephone: formValues.telephone,
      gouvernorat: formValues.gouvernorat,
      ville: formValues.ville,
      codePostal: formValues.codePostal,
      photo: this.photoPreview || undefined,
    };

    this.userService.update(this.user.id, payload).subscribe({
      next: () => {
        this.savingInfo = false;
        this.photoOk = false;
        this.authService.refreshAuthState();
        this.showToast('Profil mis à jour avec succès ✓', 'success');
        this.loadUser();
      },
      error: (err) => {
        this.savingInfo = false;
        if (err.status === 400 && err.error?.error === 'PHOTO_REJECTED') {
          this.photoPreview = this.user?.photo || null;
          this.photoError = err.error.message || 'Photo refusée';
          this.showToast(err.error.message || 'Photo refusée ❌', 'error');
          return;
        }
        this.showToast('Erreur lors de la sauvegarde', 'error');
      }
    });
  }

  // ============================================
  // GESTION DU MOT DE PASSE
  // ============================================
  changePwd(): void {
    this.pwdForm.markAllAsTouched();
    if (this.pwdForm.invalid) return;
    this.savingPwd = true;

    this.http.post(`${environment.apiUrl}/api/auth/change-password`, {
      currentPassword: this.pwdForm.value.currentPassword,
      newPassword: this.pwdForm.value.newPassword,
    }).subscribe({
      next: () => {
        this.savingPwd = false;
        this.pwdForm.reset();
        this.showToast('Mot de passe modifié ✓', 'success');
      },
      error: (err) => {
        this.savingPwd = false;
        const msg = err.status === 400 ? 'Mot de passe actuel incorrect' : 'Erreur serveur';
        this.showToast(msg, 'error');
      }
    });
  }

  // ============================================
  // GESTION DU STATUT AGENT
  // ============================================
  updateAgentStatus(): void {
    if (!this.user || !this.selectedAgentStatus) return;
    this.savingAgentStatus = true;

    this.userService.updateAgentStatus(
      this.user.id, this.selectedAgentStatus
    ).subscribe({
      next: () => {
        this.savingAgentStatus = false;
        if (this.user) this.user.agentStatus = this.selectedAgentStatus;
        this.showToast('Statut mis à jour ✓', 'success');
      },
      error: () => {
        this.savingAgentStatus = false;
        this.showToast('Erreur mise à jour statut', 'error');
      }
    });
  }

  getAgentStatusInfo(key: string) {
    return this.agentStatusOptions.find(o => o.key === key)
      ?? { key, label: key, color: '#9CA3AF', dot: '⚫' };
  }

  // ============================================
  // AI SUGGESTION
  // ============================================
  async getAiSuggestion(): Promise<void> {
    if (!this.user || this.aiLoading) return;
    this.aiLoading = true;
    this.showAiSuggestion = true;
    this.aiSuggestion = '';

    const missingFields: string[] = [];
    if (!this.user.telephone) missingFields.push('numéro de téléphone');
    if (!this.user.gouvernorat) missingFields.push('gouvernorat');
    if (!this.user.ville) missingFields.push('ville');
    if (!this.user.photo) missingFields.push('photo de profil');

    const prompt = `Tu es un assistant sympathique pour CityVoice, une plateforme civique tunisienne.
L'utilisateur ${this.user.nom} a un profil complété à ${this.profileCompletion}%.
${missingFields.length > 0
      ? `Il manque : ${missingFields.join(', ')}.`
      : 'Son profil est complet !'}
Rôle : ${this.user.role === 'CITOYEN' ? 'Citoyen' : 'Agent municipal'}.
Points : ${this.user.points}.

Génère un message d'encouragement court (2-3 phrases max), chaleureux et personnalisé en français.
${missingFields.length > 0
      ? 'Encourage-le à compléter son profil en mentionnant les bénéfices concrets.'
      : 'Félicite-le pour son profil complet et ses points.'}
Utilise des emojis. Sois direct et authentique.`;

    this.http.post<{ suggestion: string }>(
      `${environment.apiUrl}/api/ai/suggest`,
      { prompt }
    ).subscribe({
      next: (res) => {
        this.aiSuggestion = res.suggestion;
        this.aiLoading = false;
      },
      error: () => {
        this.aiSuggestion = 'Continuez à améliorer votre profil pour avoir plus d\'impact dans votre ville ! 🏙️';
        this.aiLoading = false;
      }
    });
  }

  closeAiSuggestion(): void {
    this.showAiSuggestion = false;
    this.aiSuggestion = '';
  }

  // ============================================
  // CIVIC CARD
  // ============================================
  openCivicCard(): void {
    this.civicCardLoading = true;
    this.showCivicCard = true;

    const auth = this.authService.getCurrentUser();
    if (!auth?.userId) return;

    this.userService.getUserBadges(auth.userId).subscribe({
      next: (badges) => {
        this.civicCardBadges = badges.slice(0, 4);
        this.civicCardLoading = false;
      },
      error: () => {
        this.civicCardLoading = false;
      }
    });
  }

  closeCivicCard(): void {
    this.showCivicCard = false;
  }

  get cardTrustIcon(): string {
    const pts = this.user?.points ?? 0;
    if (pts >= 1000) return '👑';
    if (pts >= 500) return '💎';
    if (pts >= 200) return '🔥';
    if (pts >= 50) return '⭐';
    return '🌱';
  }

  get cardTrustLabel(): string {
    const pts = this.user?.points ?? 0;
    if (pts >= 1000) return 'Ambassadeur';
    if (pts >= 500) return 'Vétéran';
    if (pts >= 200) return 'Habitué';
    if (pts >= 50) return 'Membre';
    return 'Nouveau';
  }

  get cardMemberSince(): string {
    if (!this.user?.dateInscription) return '—';
    return new Date(this.user.dateInscription).toLocaleDateString('fr-FR', {
      month: 'long', year: 'numeric'
    });
  }

  get qrCodeUrl(): string {
    if (!this.user) return '';
    const profileLink = `${window.location.origin}/user/profil/${this.user.id}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(profileLink)}&bgcolor=FFFFFF&color=0C1F3F&margin=0`;
  }

  async downloadCard(): Promise<void> {
    const html2canvas = (window as any).html2canvas;
    if (!html2canvas) {
      this.showToast('Téléchargement non disponible', 'error');
      return;
    }

    try {
      const el = document.querySelector('.civic-card') as HTMLElement;
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `cityvoice-carte-${this.user?.nom?.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showToast('Carte téléchargée ✓', 'success');
    } catch (e) {
      this.showToast('Erreur lors du téléchargement', 'error');
    }
  }

  async shareCard(): Promise<void> {
    if (!navigator.share) {
      this.downloadCard();
      return;
    }
    try {
      await navigator.share({
        title: 'Ma Carte CityVoice',
        text: `Je suis ${this.roleLabel(this.user?.role || '')} sur CityVoice avec ${this.user?.points} points !`,
        url: window.location.origin,
      });
    } catch { }
  }

  // ============================================
  // TRUST LEVEL & PROGRESSION
  // ============================================
  getTrustInfo(points: number, trustLevel?: string): TrustInfo {
    const levels = [
      { level: 'NOUVEAU', label: 'Nouveau', icon: '🌱', color: '#9CA3AF', minPts: 0, maxPts: 49, nextLabel: 'Membre' },
      { level: 'MEMBRE', label: 'Membre', icon: '⭐', color: '#3B82F6', minPts: 50, maxPts: 199, nextLabel: 'Habitué' },
      { level: 'HABITUE', label: 'Habitué', icon: '🔥', color: '#C9973E', minPts: 200, maxPts: 499, nextLabel: 'Vétéran' },
      { level: 'VETERAN', label: 'Vétéran', icon: '💎', color: '#8B5CF6', minPts: 500, maxPts: 999, nextLabel: 'Ambassadeur' },
      { level: 'AMBASSADEUR', label: 'Ambassadeur', icon: '👑', color: '#E8532A', minPts: 1000, maxPts: 9999, nextLabel: '' },
    ];

    const current = levels.find(l => l.level === (trustLevel ?? this.calculateTrustLevel(points)))
      ?? levels[0];

    const range = current.maxPts - current.minPts;
    const progress = Math.min(100, Math.round(((points - current.minPts) / range) * 100));

    return { ...current, progress };
  }

  private calculateTrustLevel(points: number): string {
    if (points >= 1000) return 'AMBASSADEUR';
    if (points >= 500) return 'VETERAN';
    if (points >= 200) return 'HABITUE';
    if (points >= 50) return 'MEMBRE';
    return 'NOUVEAU';
  }

  trustStarCount(level: string): number {
    const map: Record<string, number> = {
      NOUVEAU: 1, MEMBRE: 2, HABITUE: 3, VETERAN: 4, AMBASSADEUR: 5
    };
    return map[level] ?? 1;
  }

  // ============================================
  // MÉTHODES UTILITAIRES (CALCULS)
  // ============================================
  get profileCompletion(): number {
    if (!this.user) return 0;
    const fields = [
      this.user.nom,
      this.user.email,
      this.user.telephone,
      this.user.gouvernorat,
      this.user.ville,
      this.user.photo,
    ];
    const filled = fields.filter(f => f && f.trim() !== '').length;
    return Math.round((filled / fields.length) * 100);
  }

  isCitoyen(): boolean {
    return this.user?.role === 'CITOYEN';
  }

  get initials(): string {
    if (!this.user?.nom) return '?';
    return this.user.nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  // ============================================
  // MÉTHODES DE STYLE (RÔLES)
  // ============================================
  roleLabel(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'Citoyen', CHEF_EQUIPE: 'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain', MODERATEUR: 'Modérateur', ADMIN_VILLE: 'Admin',
    };
    return map[role] ?? role;
  }

  roleColor(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: '#0D9B76', CHEF_EQUIPE: '#3B82F6',
      MEMBRE_EQUIPE: '#C9973E', MODERATEUR: '#E8532A', ADMIN_VILLE: '#7C3AED',
    };
    return map[role] ?? '#8888A8';
  }

  roleBg(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'rgba(13,155,118,.1)', CHEF_EQUIPE: 'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)', MODERATEUR: 'rgba(232,83,42,.1)',
      ADMIN_VILLE: 'rgba(124,58,237,.1)',
    };
    return map[role] ?? 'rgba(136,136,168,.1)';
  }

  // ============================================
  // MÉTHODES DE STYLE (STATUT)
  // ============================================
  getStatutLabel(statut: string): string {
    const map: Record<string, string> = {
      ACTIF: 'Actif',
      NOUVEAU: 'Nouveau membre',
      INCOMPLET: 'Profil incomplet',
      EN_ATTENTE_VERIFICATION: 'Email non vérifié',
      SUSPENDU: 'Suspendu',
    };
    return map[statut] ?? statut;
  }

  getStatutColor(statut: string): string {
    const map: Record<string, string> = {
      ACTIF: '#0D9B76',
      NOUVEAU: '#3B82F6',
      INCOMPLET: '#C9973E',
      EN_ATTENTE_VERIFICATION: '#F97316',
      SUSPENDU: '#E8532A',
    };
    return map[statut] ?? '#9CA3AF';
  }

  getStatutBg(statut: string): string {
    const map: Record<string, string> = {
      ACTIF: 'rgba(13,155,118,.1)',
      NOUVEAU: 'rgba(59,130,246,.1)',
      INCOMPLET: 'rgba(201,151,62,.1)',
      EN_ATTENTE_VERIFICATION: 'rgba(249,115,22,.1)',
      SUSPENDU: 'rgba(232,83,42,.1)',
    };
    return map[statut] ?? 'rgba(156,163,175,.1)';
  }

  // ============================================
  // MÉTHODES DE STYLE (CIVIC INDEX)
  // ============================================
  getCivicIndexColor(index: number): string {
    if (index >= 80) return '#0D9B76';
    if (index >= 60) return '#3B82F6';
    if (index >= 40) return '#C9973E';
    return '#E8532A';
  }

  getCivicIndexLabel(index: number): string {
    if (index >= 80) return 'Excellent';
    if (index >= 60) return 'Bon';
    if (index >= 40) return 'Moyen';
    return 'À améliorer';
  }

  // ── WhatsApp notifications (CallMeBot) ──────────────────────
  whatsappNotifs    = false;
  savingWhatsapp    = false;
  whatsappMsg       = '';
  whatsappSuccess   = true;

  // ── SMS notifications (canal alternatif) ────────────────────
  smsNotifs         = false;
  savingSms         = false;
  smsMsg            = '';
  smsSuccess        = true;

  toggleWhatsapp(): void {
    if (!this.user?.telephone) return;
    if (this.savingWhatsapp) return;

    this.savingWhatsapp = true;
    this.whatsappMsg    = '';

    const newVal = !this.whatsappNotifs;

    this.http.patch<{ whatsappNotifs: boolean; message: string }>(
      `${environment.apiUrl}/api/users/${this.user.id}/whatsapp-notifs`,
      { whatsappNotifs: newVal }
    ).subscribe({
      next: (res) => {
        this.whatsappNotifs  = res.whatsappNotifs;
        this.whatsappMsg     = res.message ||
          (res.whatsappNotifs ? 'Notifications WhatsApp activées ✓' : 'Notifications WhatsApp désactivées');
        this.whatsappSuccess = true;
        this.savingWhatsapp  = false;
        if (this.user) this.user.whatsappNotifs = res.whatsappNotifs;
      },
      error: (err) => {
        this.savingWhatsapp  = false;
        this.whatsappSuccess = false;
        const errData = err?.error;
        if (errData?.error === 'PHONE_REQUIRED') {
          this.whatsappMsg = 'Ajoutez un numéro de téléphone dans l\'onglet Informations.';
        } else {
          this.whatsappMsg = 'Erreur lors de la mise à jour. Réessayez.';
        }
      }
    });
  }

  // ── Toggle SMS ─────────────────────────────────────────────
  toggleSms(): void {
    if (!this.user?.telephone) return;
    if (this.savingSms) return;

    this.savingSms = true;
    this.smsMsg    = '';

    const newVal = !this.smsNotifs;

    this.http.patch<{ smsNotifs: boolean; message: string }>(
      `${environment.apiUrl}/api/users/${this.user.id}/sms-notifs`,
      { smsNotifs: newVal }
    ).subscribe({
      next: (res) => {
        this.smsNotifs  = res.smsNotifs;
        this.smsMsg     = res.message ||
          (res.smsNotifs ? 'Notifications SMS activées ✓' : 'Notifications SMS désactivées');
        this.smsSuccess = true;
        this.savingSms  = false;
        if (this.user) this.user.smsNotifs = res.smsNotifs;
      },
      error: (err) => {
        this.savingSms  = false;
        this.smsSuccess = false;
        const errData = err?.error;
        if (errData?.error === 'PHONE_REQUIRED') {
          this.smsMsg = 'Ajoutez un numéro de téléphone dans l\'onglet Informations.';
        } else {
          this.smsMsg = 'Erreur lors de la mise à jour. Réessayez.';
        }
      }
    });
  }

  // ============================================
  // NOTIFICATIONS (TOAST)
  // ============================================
  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg = msg;
    this.toastType = type;
    this.toast = true;
    setTimeout(() => {
      const el = document.querySelector('.profile-toast');
      if (!el || typeof gsap === 'undefined') {
        setTimeout(() => { this.toast = false; }, 3000);
        return;
      }
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .4, ease: 'back.out(1.6)' });
      setTimeout(() => {
        gsap.to(el, {
          opacity: 0, y: 30, duration: .35,
          onComplete: () => { this.toast = false; }
        });
      }, 3000);
    }, 50);
  }
}
