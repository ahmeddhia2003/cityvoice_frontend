import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserDto } from '../../../core/services/user.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
declare const gsap: any;

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

  user: UserDto | null = null;
  loading = true;
  activeTab: 'info' | 'security' | 'activity' = 'info';

  infoForm!: FormGroup;
  pwdForm!:  FormGroup;

  savingInfo = false;
  savingPwd  = false;

  photoPreview: string | null = null;
  photoHover   = false;

  toast     = false;
  toastMsg  = '';
  toastType: 'success' | 'error' = 'success';

  // Ajouter dans les propriétés
  aiSuggestion:    string  = '';
  aiLoading:       boolean = false;
  showAiSuggestion: boolean = false;

  readonly gouvernorats = [
    'Ariana','Béja','Ben Arous','Bizerte','Gabès','Gafsa','Jendouba',
    'Kairouan','Kasserine','Kébili','Le Kef','Mahdia','La Manouba',
    'Médenine','Monastir','Nabeul','Sfax','Sidi Bouzid','Siliana',
    'Sousse','Tataouine','Tozeur','Tunis','Zaghouan',
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.infoForm = this.fb.group({
      nom:         ['', Validators.required],
      email:       [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      telephone:   ['', [Validators.pattern(/^[0-9+\s]{8,15}$/)]],
      gouvernorat: [''],
      ville:       [''],
      codePostal:  ['', Validators.pattern(/^[0-9]{4}$/)],
    });

    this.pwdForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    }, { validators: passwordMatchValidator });

    this.loadUser();
  }

  loadUser(): void {
    const auth = this.authService.getCurrentUser();
    if (!auth?.userId) return;

    this.userService.getById(auth.userId).subscribe({
      next: (u) => {
        this.user        = u;
        this.loading     = false;
        this.photoPreview = u.photo || null;
        this.infoForm.patchValue({
          nom:         u.nom,
          email:       u.email,
          telephone:   u.telephone  || '',
          gouvernorat: u.gouvernorat || '',
          ville:       u.ville       || '',
          codePostal:  u.codePostal  || '',
        });
      },
      error: () => { this.loading = false; }
    });
  }

  setTab(tab: 'info' | 'security' | 'activity'): void {
    this.activeTab = tab;
  }

  // ── Photo ────────────────────────────────────────────────
  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Image trop lourde (max 5 Mo)', 'error');
      return;
    }
    this.compressImage(file, 200, 0.7).then(b64 => {
      this.photoPreview = b64;
    });
  }

  private compressImage(file: File, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d')!;
      const img    = new Image();
      const url    = URL.createObjectURL(file);

      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
        else        { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }

        canvas.width  = Math.round(w);
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
    if (!this.user) return;

    // Supprimer aussi côté backend
    this.userService.update(this.user.id, { photo: '' }).subscribe({
      next: () => {
        this.authService.refreshAuthState();
        this.showToast('Photo supprimée', 'success');
      },
      error: () => this.showToast('Erreur suppression photo', 'error')
    });
  }

  // ── Sauvegarder infos ────────────────────────────────────
  saveInfo(): void {
    if (this.infoForm.invalid || !this.user) return;
    this.savingInfo = true;

    const formValues = this.infoForm.getRawValue();

    const payload = {
      nom:         formValues.nom,
      telephone:   formValues.telephone,
      gouvernorat: formValues.gouvernorat,
      ville:       formValues.ville,
      codePostal:  formValues.codePostal,
      photo:       this.photoPreview || undefined,
      // email is NOT included
    };

    this.userService.update(this.user.id, payload).subscribe({
      next: () => {
        this.savingInfo = false;
        this.authService.refreshAuthState();
        this.showToast('Profil mis à jour avec succès ✓', 'success');
        this.loadUser();
      },
      error: () => {
        this.savingInfo = false;
        this.showToast('Erreur lors de la sauvegarde', 'error');
      }
    });
  }

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
  // ── Changer mot de passe ─────────────────────────────────
  changePwd(): void {
    this.pwdForm.markAllAsTouched();
    if (this.pwdForm.invalid) return;
    this.savingPwd = true;

    this.http.post(`${environment.apiUrl}/api/auth/change-password`, {
      currentPassword: this.pwdForm.value.currentPassword,
      newPassword:     this.pwdForm.value.newPassword,
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

  // ── Helpers ──────────────────────────────────────────────
  get initials(): string {
    if (!this.user?.nom) return '?';
    return this.user.nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

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

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  //AI
  // Ajouter la méthode
  async getAiSuggestion(): Promise<void> {
    if (!this.user || this.aiLoading) return;
    this.aiLoading        = true;
    this.showAiSuggestion = true;
    this.aiSuggestion     = '';

    const missingFields: string[] = [];
    if (!this.user.telephone)   missingFields.push('numéro de téléphone');
    if (!this.user.gouvernorat) missingFields.push('gouvernorat');
    if (!this.user.ville)       missingFields.push('ville');
    if (!this.user.photo)       missingFields.push('photo de profil');

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
        this.aiLoading    = false;
      },
      error: () => {
        this.aiSuggestion = 'Continuez à améliorer votre profil pour avoir plus d\'impact dans votre ville ! 🏙️';
        this.aiLoading    = false;
      }
    });
  }

  closeAiSuggestion(): void {
    this.showAiSuggestion = false;
    this.aiSuggestion     = '';
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg  = msg;
    this.toastType = type;
    this.toast     = true;
    setTimeout(() => {
      const el = document.querySelector('.profile-toast');
      if (!el || typeof gsap === 'undefined') {
        setTimeout(() => { this.toast = false; }, 3000);
        return;
      }
      gsap.fromTo(el, { opacity:0, y:30 }, { opacity:1, y:0, duration:.4, ease:'back.out(1.6)' });
      setTimeout(() => {
        gsap.to(el, { opacity:0, y:30, duration:.35,
          onComplete: () => { this.toast = false; }
        });
      }, 3000);
    }, 50);
  }
}
