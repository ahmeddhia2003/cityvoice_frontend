import {
  Component, OnInit, AfterViewInit,
  ElementRef, ViewChild, NgZone
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { SoundService } from '../../../core/services/sound.service';
import { AuthService } from '../../../core/services/auth.service';
declare const gsap: any;

// ── Validateur custom : confirmPassword ──────────────────
function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pwd     = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pwd && confirm && pwd !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class SignupComponent implements OnInit, AfterViewInit {

  @ViewChild('photoInput') photoInputRef!: ElementRef<HTMLInputElement>;

  // ── Navigation ───────────────────────────────────────────
  step = 0;
  userType: 'CITOYEN' | 'AGENT' | null = null;
  selectedRole: string | null = null;

  readonly agentRoles = [
    {
      key: 'CHEF_EQUIPE',
      label: 'Chef d\'équipe',
      desc: 'Planification et supervision des interventions terrain',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,.08)',
      border: 'rgba(59,130,246,.2)',
    },
    {
      key: 'MEMBRE_EQUIPE',
      label: 'Agent terrain',
      desc: 'Interventions directes et résolution des signalements',
      color: '#C9973E',
      bg: 'rgba(201,151,62,.08)',
      border: 'rgba(201,151,62,.2)',
    },
    {
      key: 'MODERATEUR',
      label: 'Modérateur',
      desc: 'Modération du contenu et qualité de la plateforme',
      color: '#E8532A',
      bg: 'rgba(232,83,42,.08)',
      border: 'rgba(232,83,42,.2)',
    },
  ];

  // ── Listes géographiques ─────────────────────────────────
  readonly gouvernorats = [
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès',
    'Gafsa', 'Jendouba', 'Kairouan', 'Kasserine', 'Kébili',
    'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir',
    'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse',
    'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
  ];

  // ── Form ─────────────────────────────────────────────────
  form!: FormGroup;
  showPwd        = false;
  showConfirmPwd = false;
  loading        = false;
  success        = false;
  toast          = false;
  toastMsg       = '';
  toastType      = '';

  photoPreview: string | null = null;
  photoHover   = false;
  photoName    = '';
  photoError   = '';

  pwdScore = 0;
  pwdLabel = 'Force du mot de passe';
  pwdColor = '#8888A8';

  get pwdBars(): string[] {
    const map = ['', 'weak', 'fair', 'good', 'good'];
    return [0,1,2,3].map(i => i < this.pwdScore ? (map[this.pwdScore] ?? '') : '');
  }

  get initials(): string {
    const fn = this.form?.get('firstName')?.value || '';
    const ln = this.form?.get('lastName')?.value  || '';
    return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '?';
  }

  get stepsForRole(): { title: string; subtitle: string }[] {
    return [
      { title: 'Identité',      subtitle: 'Vos informations personnelles' },
      { title: 'Accès',         subtitle: 'Email et mot de passe' },
      { title: 'Localisation',  subtitle: 'Votre adresse' },
      { title: 'Profil',        subtitle: 'Photo et confirmation' },
    ];
  }

  get currentStepInfo(): { title: string; subtitle: string } | undefined {
    return this.stepsForRole[this.step - 1];
  }
  get isLastStep(): boolean { return this.step === this.stepsForRole.length; }

  get selectedRoleColor(): string {
    if (this.userType === 'CITOYEN') return '#0D9B76';
    return this.agentRoles.find(r => r.key === this.selectedRole)?.color ?? '#8888A8';
  }

  get selectedRoleLabel(): string {
    if (this.userType === 'CITOYEN') return 'Citoyen';
    return this.agentRoles.find(r => r.key === this.selectedRole)?.label ?? '';
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    public sound: SoundService,
    private authService: AuthService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName:      ['', Validators.required],
      lastName:       ['', Validators.required],
      telephone:      ['', [Validators.required, Validators.pattern(/^[0-9+\s]{8,15}$/)]],
      email:          ['', [Validators.required, Validators.email]],
      password:       ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword:['', Validators.required],
      invitationCode: [''],
      gouvernorat:    ['', Validators.required],
      ville:          ['', Validators.required],
      codePostal:     ['', [Validators.pattern(/^[0-9]{4}$/)]],
      terms:          [false, Validators.requiredTrue],
    }, { validators: passwordMatchValidator });

    this.form.get('password')?.valueChanges.subscribe(v => this.checkPwd(v));
  }

  ngAfterViewInit(): void {
    if (typeof gsap === 'undefined') return;
    this.animateEntrance();
  }

  private animateEntrance(): void {
    const tl = gsap.timeline();
    tl
      .fromTo('.auth-left',  { x:-80, opacity:0 },   { x:0, opacity:1, duration:.8, ease:'power3.out' }, .1)
      .fromTo('.auth-logo',  { opacity:0, y:-16 },    { opacity:1, y:0, duration:.5 }, .3)
      .fromTo('.lt-word',    { y:'100%' },             { y:'0%', duration:.7, stagger:.08, ease:'power4.out' }, .4)
      .fromTo('.auth-desc',  { opacity:0, y:20 },      { opacity:1, y:0, duration:.5 }, .8)
      .fromTo('.stat-chip',  { opacity:0, scale:.85 }, { opacity:1, scale:1, duration:.4, stagger:.08, ease:'back.out(1.5)' }, 1.0)
      .fromTo('.auth-proof', { opacity:0 },            { opacity:1, duration:.4 }, 1.2)
      .fromTo('.auth-card',  { opacity:0, y:30 },      { opacity:1, y:0, duration:.7, ease:'power3.out' }, .5)
      .fromTo('.auth-pin-1', { opacity:0, x:20 },      { opacity:1, x:0, duration:.5, ease:'back.out(2)' }, 1.1)
      .fromTo('.auth-pin-2', { opacity:0, x:20 },      { opacity:1, x:0, duration:.5, ease:'back.out(2)' }, 1.3);

    gsap.to('.auth-pin-1', { y:-8,  duration:3,   yoyo:true, repeat:-1, ease:'sine.inOut', delay:1.2 });
    gsap.to('.auth-pin-2', { y:-6,  duration:3.5, yoyo:true, repeat:-1, ease:'sine.inOut', delay:1.8 });
    gsap.to('.auth-orb-1', { x:20,  y:-20, duration:5, yoyo:true, repeat:-1, ease:'sine.inOut' });
    gsap.to('.auth-orb-2', { x:-15, y:15,  duration:6, yoyo:true, repeat:-1, ease:'sine.inOut', delay:1 });
  }

  // ── Step 0 ───────────────────────────────────────────────
  selectUserType(type: 'CITOYEN' | 'AGENT'): void {
    this.sound.click();
    this.userType = type;
    if (type === 'CITOYEN') {
      this.selectedRole = 'CITOYEN';
      this.animateStepOut(() => { this.step = 1; this.animateStepIn(); });
    } else {
      this.animateStepOut(() => { this.step = -1; this.animateStepIn(); });
    }
  }

  // ── Step -1 ──────────────────────────────────────────────
  selectAgentRole(key: string): void {
    this.sound.click();
    this.selectedRole = key;
  }

  confirmAgentRole(): void {
    if (!this.selectedRole) return;
    this.sound.click();
    this.animateStepOut(() => { this.step = 1; this.animateStepIn(); });
  }

  prevStepAgent(): void {
    this.sound.nav();
    this.animateStepOut(() => {
      this.step = 0;
      this.userType = null;
      this.selectedRole = null;
      this.animateStepIn();
    }, 'back');
  }

  // ── Navigation ───────────────────────────────────────────
  nextStep(): void {
    // Toucher tous les champs de l'étape pour déclencher les erreurs
    this.touchCurrentStep();

    if (!this.canProceed()) {
      this.sound.toggle2(false);
      if (typeof gsap !== 'undefined') {
        gsap.to('.step-section', { x:[-6,6,-4,4,0], duration:.35, ease:'none' });
      }
      return;
    }
    this.sound.click();
    if (this.step < this.stepsForRole.length) {
      this.animateStepOut(() => { this.step++; this.animateStepIn(); });
    } else {
      this.onSubmit();
    }
  }

  // Touche les champs de l'étape courante pour afficher les erreurs
  private touchCurrentStep(): void {
    const fieldsPerStep: Record<number, string[]> = {
      1: ['firstName', 'lastName', 'telephone'],
      2: ['email', 'password', 'confirmPassword', 'invitationCode'],
      3: ['gouvernorat', 'ville', 'codePostal'],
      4: ['terms'],
    };
    const fields = fieldsPerStep[this.step] ?? [];
    fields.forEach(f => this.form.get(f)?.markAsTouched());
  }

  prevStep(): void {
    this.sound.nav();
    if (this.step > 1) {
      this.animateStepOut(() => { this.step--; this.animateStepIn(); }, 'back');
    } else if (this.step === 1 && this.userType === 'AGENT') {
      this.animateStepOut(() => { this.step = -1; this.animateStepIn(); }, 'back');
    } else {
      this.animateStepOut(() => {
        this.step = 0;
        this.userType = null;
        this.selectedRole = null;
        this.animateStepIn();
      }, 'back');
    }
  }

  canProceed(): boolean {
    switch (this.step) {
      case 1:
        return this.form.get('firstName')!.valid &&
          this.form.get('lastName')!.valid &&
          this.form.get('telephone')!.valid;
      case 2: {
        const emailOk   = this.form.get('email')!.valid;
        const pwdOk     = this.form.get('password')!.valid;
        const matchOk   = !this.form.errors?.['passwordMismatch'] &&
          !!this.form.get('confirmPassword')?.value;
        const codeOk    = this.userType !== 'AGENT' ||
          !!this.form.get('invitationCode')?.value?.trim();
        return emailOk && pwdOk && matchOk && codeOk;
      }
      case 3:
        return this.form.get('gouvernorat')!.valid &&
          this.form.get('ville')!.valid &&
          (this.form.get('codePostal')!.valid || !this.form.get('codePostal')!.value);
      case 4:
        return this.form.get('terms')!.valid;
      default:
        return true;
    }
  }

  private animateStepOut(cb: () => void, dir: 'forward' | 'back' = 'forward'): void {
    if (typeof gsap === 'undefined') { this.ngZone.run(cb); return; }
    const x = dir === 'forward' ? -30 : 30;
    gsap.to('.step-section', {
      opacity:0, x, duration:.22, ease:'power2.in',
      onComplete: () => { this.ngZone.run(cb); }
    });
  }

  private animateStepIn(): void {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo('.step-section',
      { opacity:0, x:30 },
      { opacity:1, x:0, duration:.32, ease:'power3.out' }
    );
  }

  // ── Photo ────────────────────────────────────────────────
  triggerPhoto(): void {
    this.sound.click();
    this.photoInputRef?.nativeElement.click();
  }

  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.photoError = '';

    if (!file.type.startsWith('image/')) {
      this.photoError = 'Fichier non valide.';
      this.sound.toggle2(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError = 'Image trop lourde. Max 5 Mo.';
      this.sound.toggle2(false);
      return;
    }

    this.compressImage(file, 200, 0.7).then(b64 => {
      this.photoPreview = b64;
      this.photoName    = file.name;
      this.sound.success();
      if (typeof gsap !== 'undefined') {
        gsap.fromTo('.photo-preview',
          { scale: .6, opacity: 0 },
          { scale: 1,  opacity: 1, duration: .5, ease: 'back.out(1.8)' }
        );
      }
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
    this.sound.nav();
    this.photoPreview = null;
    this.photoName    = '';
    this.photoError   = '';
    if (this.photoInputRef?.nativeElement) {
      this.photoInputRef.nativeElement.value = '';
    }
  }

  // ── Password ─────────────────────────────────────────────
  private checkPwd(val: string): void {
    let score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;
    this.pwdScore = score;
    const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
    const colors = ['#8888A8','#E8532A','#C9973E','#0D9B76','#0D9B76'];
    this.pwdLabel = score > 0 ? `Mot de passe ${labels[score]}` : 'Force du mot de passe';
    this.pwdColor = colors[score];
  }

  togglePwd():          void { this.sound.nav(); this.showPwd = !this.showPwd; }
  toggleConfirmPwd():   void { this.sound.nav(); this.showConfirmPwd = !this.showConfirmPwd; }
  onInput():            void { this.sound.nav(); }
  onToggle(v: boolean): void { this.sound.toggle2(v); }

  // ── Submit ───────────────────────────────────────────────
  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) { this.sound.toggle2(false); return; }

    this.sound.click();
    this.loading = true;

    const { firstName, lastName, email, password, telephone,
      invitationCode, gouvernorat, ville, codePostal } = this.form.value;

    this.authService.register({
      nom:            `${firstName} ${lastName}`,
      email,
      password,
      telephone,
      role:           this.selectedRole!,
      invitationCode: this.userType === 'AGENT' ? invitationCode : undefined,
      gouvernorat,
      ville,
      codePostal:     codePostal || undefined,
    }).subscribe({
      next: (registerRes: any) => {
        this.loading = false;
        this.success = true;
        this.sound.success();
        this.showToast('Vérifiez votre email pour activer votre compte 📧', 'success');
        setTimeout(() => {
          this.router.navigate(['/auth/email-pending'], {
            state: { email: this.form.value.email }  // ← passer l'email
          });
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        this.sound.toggle2(false);
        if (typeof gsap !== 'undefined') {
          gsap.to('.auth-submit', { x:[-6,6,-4,4,0], duration:.4, ease:'none' });
        }
        const msg = err.status === 400 ? 'Email déjà utilisé'
          : err.status === 403 ? 'Code d\'invitation invalide ou expiré'
            : 'Erreur serveur, réessayez !';
        this.showToast(msg, 'error');
      }
    });
  }

  goSignin(): void { this.sound.nav(); this.router.navigate(['/auth/signin']); }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    // Reset d'abord si un toast est déjà affiché
    this.toast = false;

    // Laisser Angular détruire l'ancien toast puis en créer un nouveau
    setTimeout(() => {
      this.toastMsg  = msg;
      this.toastType = type;
      this.toast     = true;

      // Attendre le prochain cycle de rendu Angular
      setTimeout(() => {
        if (typeof gsap === 'undefined') {
          // Pas de GSAP → on laisse visible 3s puis on ferme
          setTimeout(() => { this.toast = false; }, 3000);
          return;
        }

        const el = document.querySelector('.auth-toast');
        if (!el) return;

        gsap.killTweensOf(el);
        gsap.fromTo(el,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: .4, ease: 'back.out(1.6)' }
        );

        setTimeout(() => {
          const toastEl = document.querySelector('.auth-toast');
          if (!toastEl) return;
          gsap.to(toastEl, {
            opacity: 0, y: 30, duration: .35, ease: 'power2.in',
            onComplete: () => {
              this.ngZone.run(() => { this.toast = false; });
            }
          });
        }, 3000);

      }, 50); // laisser Angular rendre le DOM
    }, 50);
  }
}
