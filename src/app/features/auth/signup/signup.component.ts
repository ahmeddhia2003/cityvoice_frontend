import {
  Component, OnInit, AfterViewInit,
  ElementRef, ViewChild, NgZone
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { SoundService } from '../../../core/services/sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { TunisiaLocationService } from '../../../core/services/tunisia-location.service';
import { debounceTime } from 'rxjs';
declare const gsap: any;

// ============================================================
// VALIDATORS
// ============================================================

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pwd     = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pwd && confirm && pwd !== confirm ? { passwordMismatch: true } : null;
}

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class SignupComponent implements OnInit, AfterViewInit {

  // ============================================================
  // 1. PROPRIÉTÉS PUBLIQUES - VIEW CHILD & RÉFÉRENCES
  // ============================================================

  @ViewChild('photoInput') photoInputRef!: ElementRef<HTMLInputElement>;

  // ============================================================
  // 2. PROPRIÉTÉS PUBLIQUES - ÉTAT DU COMPOSANT
  // ============================================================

  step = 0;
  userType: 'CITOYEN' | 'AGENT' | null = null;
  selectedRole: string | null = null;
  loading = false;
  success = false;
  toast = false;
  toastMsg = '';
  toastType = '';

  // ============================================================
  // 3. PROPRIÉTÉS PUBLIQUES - UI (AFFICHAGE, TOGGLES, ETC.)
  // ============================================================

  showPwd = false;
  showConfirmPwd = false;
  photoHover = false;
  photoPreview: string | null = null;
  photoName = '';
  photoError = '';
  photoChecking = false;
  photoOk = false;

  // ============================================================
  // 4. PROPRIÉTÉS PUBLIQUES - VALIDATION TEMPS RÉEL
  // ============================================================

  nameChecking = false;
  nameError = '';
  nameOk = false;
  private nameRequestId = 0;

  emailChecking = false;
  emailError = '';
  emailOk = false;

  pwdScore = 0;
  pwdLabel = 'Force du mot de passe';
  pwdColor = '#8888A8';

  // ============================================================
  // 5. PROPRIÉTÉS PUBLIQUES - LOCALISATION
  // ============================================================

  governorates: string[] = [];
  delegations: string[] = [];
  loadingGouvernorats = true;
  loadingVilles = false;
  selectedGouvernorat = '';

  // ============================================================
  // 6. PROPRIÉTÉS PUBLIQUES - CONFIGURATION (READONLY)
  // ============================================================

  readonly agentRoles = [
    { key: 'CHEF_EQUIPE',   label: 'Chef d\'équipe',  desc: 'Planification et supervision des interventions terrain', color: '#3B82F6', bg: 'rgba(59,130,246,.08)',  border: 'rgba(59,130,246,.2)'  },
    { key: 'MEMBRE_EQUIPE', label: 'Agent terrain',   desc: 'Interventions directes et résolution des signalements',  color: '#C9973E', bg: 'rgba(201,151,62,.08)', border: 'rgba(201,151,62,.2)' },
    { key: 'MODERATEUR',    label: 'Modérateur',      desc: 'Modération du contenu et qualité de la plateforme',      color: '#E8532A', bg: 'rgba(232,83,42,.08)',  border: 'rgba(232,83,42,.2)'  },
  ];

  readonly gouvernorats = [
    'Ariana','Béja','Ben Arous','Bizerte','Gabès','Gafsa','Jendouba',
    'Kairouan','Kasserine','Kébili','Le Kef','Mahdia','La Manouba',
    'Médenine','Monastir','Nabeul','Sfax','Sidi Bouzid','Siliana',
    'Sousse','Tataouine','Tozeur','Tunis','Zaghouan',
  ];

  // ============================================================
  // 7. PROPRIÉTÉS PUBLIQUES - FORMULAIRE
  // ============================================================

  form!: FormGroup;

  // ============================================================
  // 8. GETTERS - STYLES & COULEURS
  // ============================================================

  get selectedRoleColor(): string {
    if (this.userType === 'CITOYEN') return '#0D9B76';
    return this.agentRoles.find(r => r.key === this.selectedRole)?.color ?? '#8888A8';
  }

  get selectedRoleLabel(): string {
    if (this.userType === 'CITOYEN') return 'Citoyen';
    return this.agentRoles.find(r => r.key === this.selectedRole)?.label ?? '';
  }

  get pwdBars(): string[] {
    const map = ['', 'weak', 'fair', 'good', 'good'];
    return [0,1,2,3].map(i => i < this.pwdScore ? (map[this.pwdScore] ?? '') : '');
  }

  get initials(): string {
    const fn = this.form?.get('firstName')?.value || '';
    const ln = this.form?.get('lastName')?.value  || '';
    return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '?';
  }

  // ============================================================
  // 9. GETTERS - LOGIQUE DE NAVIGATION
  // ============================================================

  get stepsForRole(): { title: string; subtitle: string }[] {
    return [
      { title: 'Identité',     subtitle: 'Vos informations personnelles' },
      { title: 'Accès',        subtitle: 'Email et mot de passe'         },
      { title: 'Localisation', subtitle: 'Votre adresse'                 },
      { title: 'Profil',       subtitle: 'Photo et confirmation'         },
    ];
  }

  get currentStepInfo() { return this.stepsForRole[this.step - 1]; }
  get isLastStep(): boolean { return this.step === this.stepsForRole.length; }

  // ============================================================
  // 10. GETTERS - VALIDATION PAR ÉTAPE (CAN PROCEED)
  // ============================================================

  get canProceedStep1(): boolean {
    return this.form.get('firstName')!.valid &&
      this.form.get('lastName')!.valid  &&
      this.form.get('telephone')!.valid &&
      !this.nameError && !this.nameChecking;
  }

  get canProceedStep2(): boolean {
    const emailOk = this.form.get('email')!.valid && !this.emailError && !this.emailChecking;
    const pwdOk   = this.form.get('password')!.valid;
    const matchOk = !this.form.errors?.['passwordMismatch'] && !!this.form.get('confirmPassword')?.value;
    const codeOk  = this.userType !== 'AGENT' || !!this.form.get('invitationCode')?.value?.trim();
    return emailOk && pwdOk && matchOk && codeOk;
  }

  get canProceedStep3(): boolean {
    const gouv = this.form.get('gouvernorat')?.value;
    const ville = this.form.get('ville')?.value;
    const cp = this.form.get('codePostal');

    return !!gouv && !!ville && (cp!.valid || !cp!.value);
  }

  get canProceedStep4(): boolean {
    return this.form.get('terms')!.valid && !this.photoError && !this.photoChecking;
  }

  // ============================================================
  // 11. CONSTRUCTEUR
  // ============================================================

  constructor(
    private fb: FormBuilder,
    private router: Router,
    public sound: SoundService,
    private authService: AuthService,
    private ngZone: NgZone,
    private locationService: TunisiaLocationService,
  ) {}

  // ============================================================
  // 12. LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.initForm();
    this.initFormSubscriptions();
    this.loadGovernorates();
  }

  ngAfterViewInit(): void {
    if (typeof gsap === 'undefined') return;
    this.animateEntrance();
  }

  // ============================================================
  // 13. MÉTHODES PRIVÉES - INITIALISATION
  // ============================================================

  private initForm(): void {
    this.form = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(3)]],
      lastName:  ['', [Validators.required, Validators.minLength(3)]],
      telephone:       ['', [Validators.required, Validators.pattern(/^[0-9+\s]{8,15}$/)]],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      invitationCode:  [''],
      gouvernorat:     ['', Validators.required],
      ville:           ['', Validators.required],
      codePostal:      ['', [Validators.pattern(/^[0-9]{4}$/)]],
      terms:           [false, Validators.requiredTrue],
    }, { validators: passwordMatchValidator });

    this.form.get('ville')?.disable();
  }

  private initFormSubscriptions(): void {
    this.form.get('password')?.valueChanges.subscribe(v => this.checkPwd(v));

    // Watcher nom — debounce 600ms
    this.form.get('firstName')?.valueChanges.pipe(debounceTime(600)).subscribe(() => this.checkName());
    this.form.get('lastName')?.valueChanges.pipe(debounceTime(600)).subscribe(() => this.checkName());

    // Watcher email
    this.form.get('email')?.valueChanges.subscribe(() => {
      this.emailError = '';
      this.emailChecking = false;
    });

    this.form.get('email')?.valueChanges
      .pipe(debounceTime(700))
      .subscribe(email => {
        const ctrl = this.form.get('email');
        if (!email || !ctrl?.valid) {
          this.emailChecking = false;
          this.emailError = '';
          this.emailOk = false;
          return;
        }
        this.checkEmail(email);
      });
  }

  // ============================================================
  // 14. MÉTHODES PRIVÉES - ANIMATIONS
  // ============================================================

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

  private animateStepOut(cb: () => void, dir: 'forward' | 'back' = 'forward'): void {
    if (typeof gsap === 'undefined') { this.ngZone.run(cb); return; }
    const x = dir === 'forward' ? -30 : 30;
    gsap.to('.step-section', {
      opacity: 0, x, duration: .22, ease: 'power2.in',
      onComplete: () => { this.ngZone.run(cb); }
    });
  }

  private animateStepIn(): void {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo('.step-section',
      { opacity: 0, x: 30 },
      { opacity: 1, x: 0, duration: .32, ease: 'power3.out' }
    );
  }

  // ============================================================
  // 15. MÉTHODES PRIVÉES - VALIDATION (PASSWORD, NAME, EMAIL)
  // ============================================================

  private checkPwd(val: string): void {
    let score = 0;
    if (val.length >= 8)          score++;
    if (/[A-Z]/.test(val))        score++;
    if (/[0-9]/.test(val))        score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    this.pwdScore = score;
    const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
    const colors = ['#8888A8','#E8532A','#C9973E','#0D9B76','#0D9B76'];
    this.pwdLabel = score > 0 ? `Mot de passe ${labels[score]}` : 'Force du mot de passe';
    this.pwdColor = colors[score];
  }

  private checkName(): void {
    const firstCtrl = this.form.get('firstName');
    const lastCtrl  = this.form.get('lastName');

    const first = firstCtrl?.value ?? '';
    const last  = lastCtrl?.value ?? '';

    if (!firstCtrl?.valid || !lastCtrl?.valid || !first || !last) {
      this.nameChecking = false;
      this.nameError = '';
      this.nameOk = false;
      return;
    }

    const nom = `${first} ${last}`.trim();

    this.nameChecking = true;
    this.nameError = '';
    this.nameOk = false;

    const startTime = Date.now();
    const currentRequestId = ++this.nameRequestId;

    this.authService.screenName(nom).subscribe({
      next: (res) => {
        if (currentRequestId !== this.nameRequestId) return;
        const elapsed = Date.now() - startTime;
        const delay = Math.max(1000 - elapsed, 0);

        setTimeout(() => {
          if (currentRequestId !== this.nameRequestId) return;
          this.nameChecking = false;
          if (res.appropriate) {
            this.nameOk = true;
            this.nameError = '';
          } else {
            this.nameOk = false;
            this.nameError = res.reason ?? 'Nom inapproprié';
          }
        }, delay);
      },
      error: () => {
        if (currentRequestId !== this.nameRequestId) return;
        const elapsed = Date.now() - startTime;
        const delay = Math.max(1000 - elapsed, 0);

        setTimeout(() => {
          if (currentRequestId !== this.nameRequestId) return;
          this.nameChecking = false;
          this.nameOk = true;
        }, delay);
      }
    });
  }

  private checkEmail(email: string): void {
    const ctrl = this.form.get('email');
    const value = ctrl?.value ?? '';

    if (!ctrl?.valid || !value) {
      this.emailChecking = false;
      this.emailError = '';
      this.emailOk = false;
      return;
    }

    this.emailChecking = true;
    this.emailError = '';
    this.emailOk = false;

    const startTime = Date.now();

    this.authService.checkEmail(email).subscribe({
      next: (res) => {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(1000 - elapsed, 0);

        setTimeout(() => {
          this.emailChecking = false;
          if (res.exists) {
            this.emailError = 'Cet email est déjà utilisé';
            this.emailOk = false;
          } else {
            this.emailError = '';
            this.emailOk = true;
          }
        }, delay);
      },
      error: () => {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(1000 - elapsed, 0);

        setTimeout(() => {
          this.emailChecking = false;
          this.emailOk = true;
        }, delay);
      }
    });
  }

  // ============================================================
  // 16. MÉTHODES PRIVÉES - PHOTO (COMPRESSION, MODÉRATION)
  // ============================================================

  private compressImage(file: File, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        let w = img.width, h = img.height;
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

  // ============================================================
  // 17. MÉTHODES PRIVÉES - SUBMISSION & REGISTRATION
  // ============================================================

  private touchCurrentStep(): void {
    const fieldsPerStep: Record<number, string[]> = {
      1: ['firstName', 'lastName', 'telephone'],
      2: ['email', 'password', 'confirmPassword', 'invitationCode'],
      3: ['gouvernorat', 'ville', 'codePostal'],
      4: ['terms'],
    };
    (fieldsPerStep[this.step] ?? []).forEach(f => {
      const ctrl = this.form.get(f);
      if (ctrl) {
        ctrl.markAsTouched();
        if (ctrl.disabled && !ctrl.value) {
          ctrl.enable();
          ctrl.markAsTouched();
        }
      }
    });
  }

  private doRegister(
    nom: string, email: string, password: string, telephone: string,
    invitationCode: string, gouvernorat: string, ville: string, codePostal: string
  ): void {
    this.authService.register({
      nom, email, password, telephone,
      role: this.selectedRole!,
      invitationCode: this.userType === 'AGENT' ? invitationCode : undefined,
      gouvernorat, ville,
      codePostal: codePostal || undefined,
      photo: this.photoPreview || undefined,
    }).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.sound.success();
        this.showToast('Vérifiez votre email pour activer votre compte 📧', 'success');
        setTimeout(() => {
          this.router.navigate(['/auth/email-pending'], {
            state: { email: this.form.value.email }
          });
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        this.sound.toggle2(false);
        if (typeof gsap !== 'undefined') {
          gsap.to('.auth-submit', { x:[-6,6,-4,4,0], duration:.4, ease:'none' });
        }
        const msg = err.status === 400
          ? (typeof err.error === 'string' && err.error.includes('Nom refusé')
            ? err.error : 'Email déjà utilisé')
          : err.status === 403 ? 'Code d\'invitation invalide ou expiré'
            : 'Erreur serveur, réessayez !';
        this.showToast(msg, 'error');
      }
    });
  }

  // ============================================================
  // 18. MÉTHODES PUBLIQUES - SÉLECTION DES RÔLES & NAVIGATION
  // ============================================================

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

  nextStep(): void {
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
      case 1:  return this.canProceedStep1;
      case 2:  return this.canProceedStep2;
      case 3:  return this.canProceedStep3;
      case 4:  return this.canProceedStep4;
      default: return true;
    }
  }

  // ============================================================
  // 19. MÉTHODES PUBLIQUES - PHOTO (UPLOAD, SUPPRESSION)
  // ============================================================

  triggerPhoto(): void {
    this.sound.click();
    this.photoInputRef?.nativeElement.click();
  }

  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.photoError = '';
    this.photoOk = false;

    if (!file.type.startsWith('image/')) {
      this.photoError = 'Fichier non valide (JPG, PNG uniquement)';
      this.sound.toggle2(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError = 'Image trop lourde (max 5 Mo)';
      this.sound.toggle2(false);
      return;
    }

    this.compressImage(file, 200, 0.7).then(b64 => {
      this.photoPreview = b64;
      this.photoName = file.name;
      this.photoChecking = true;
      this.photoOk = false;

      const startTime = Date.now();

      this.authService.moderatePhoto(b64).subscribe({
        next: (res) => {
          const elapsed = Date.now() - startTime;
          const delay = Math.max(1000 - elapsed, 0);

          setTimeout(() => {
            this.photoChecking = false;
            if (!res.safe) {
              this.photoError = res.reason || 'Photo inappropriée pour la plateforme';
              this.photoPreview = null;
              this.photoName = '';
              this.photoOk = false;
              this.sound.toggle2(false);
            } else {
              this.photoOk = true;
              this.sound.success();
              if (typeof gsap !== 'undefined') {
                gsap.fromTo('.photo-preview',
                  { scale: .6, opacity: 0 },
                  { scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.8)' }
                );
              }
            }
          }, delay);
        },
        error: () => {
          const elapsed = Date.now() - startTime;
          const delay = Math.max(1000 - elapsed, 0);

          setTimeout(() => {
            this.photoChecking = false;
            this.photoOk = true;
            this.sound.success();
          }, delay);
        }
      });
    });
  }

  removePhoto(): void {
    this.sound.nav();
    this.photoPreview = null;
    this.photoName = '';
    this.photoError = '';
    this.photoOk = false;
    if (this.photoInputRef?.nativeElement) {
      this.photoInputRef.nativeElement.value = '';
    }
  }

  // ============================================================
  // 20. MÉTHODES PUBLIQUES - LOCALISATION
  // ============================================================

  loadGovernorates(): void {
    this.loadingGouvernorats = true;
    this.form.get('gouvernorat')?.disable();

    this.locationService.getGovernorates().subscribe({
      next: (data) => {
        this.governorates = data;
        this.loadingGouvernorats = false;
        this.form.get('gouvernorat')?.enable();
      },
      error: () => {
        this.loadingGouvernorats = false;
        this.form.get('gouvernorat')?.enable();
      }
    });
  }

  onGouvernoratChange(): void {
    const gouvernorat = this.form.get('gouvernorat')?.value;

    this.selectedGouvernorat = gouvernorat;
    this.delegations = [];
    this.form.patchValue({ ville: '', codePostal: '' });

    if (gouvernorat) {
      this.loadingVilles = true;
      this.form.get('ville')?.disable();

      this.locationService.getDelegations(gouvernorat).subscribe({
        next: (data) => {
          this.delegations = data;
          this.loadingVilles = false;
          this.form.get('ville')?.enable();
        },
        error: () => {
          this.loadingVilles = false;
          this.form.get('ville')?.enable();
        }
      });
    } else {
      this.form.get('ville')?.disable();
    }

    this.sound.nav();
  }

  onVilleChange(): void {
    const gouvernorat = this.form.get('gouvernorat')?.value;
    const ville = this.form.get('ville')?.value;

    if (gouvernorat && ville) {
      this.locationService.getPostalCode(gouvernorat, ville).subscribe({
        next: (postalCode) => {
          if (postalCode) {
            this.form.patchValue({ codePostal: postalCode });
          }
        }
      });
    }

    this.sound.nav();
  }

  // ============================================================
  // 21. MÉTHODES PUBLIQUES - SUBMISSION & TOAST
  // ============================================================

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.sound.toggle2(false);
      return;
    }

    this.sound.click();
    this.loading = true;

    const { firstName, lastName, email, password, telephone,
      invitationCode, gouvernorat, ville, codePostal } = this.form.value;

    const nom = `${firstName} ${lastName}`.trim();

    this.authService.screenName(nom).subscribe({
      next: (result) => {
        if (!result.appropriate) {
          this.loading = false;
          this.sound.toggle2(false);
          this.showToast(result.reason ?? 'Nom inapproprié pour la plateforme ❌', 'error');
          return;
        }
        this.doRegister(nom, email, password, telephone,
          invitationCode, gouvernorat, ville, codePostal);
      },
      error: () => {
        this.doRegister(nom, email, password, telephone,
          invitationCode, gouvernorat, ville, codePostal);
      }
    });
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toast = false;
    setTimeout(() => {
      this.toastMsg = msg;
      this.toastType = type;
      this.toast = true;
      setTimeout(() => {
        if (typeof gsap === 'undefined') {
          setTimeout(() => { this.toast = false; }, 3000);
          return;
        }
        const el = document.querySelector('.auth-toast');
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .4, ease: 'back.out(1.6)' });
        setTimeout(() => {
          const toastEl = document.querySelector('.auth-toast');
          if (!toastEl) return;
          gsap.to(toastEl, {
            opacity: 0, y: 30, duration: .35, ease: 'power2.in',
            onComplete: () => { this.ngZone.run(() => { this.toast = false; }); }
          });
        }, 3000);
      }, 50);
    }, 50);
  }

  // ============================================================
  // 22. MÉTHODES PUBLIQUES - UTILITAIRES (TOGGLES, NAVIGATION)
  // ============================================================

  togglePwd(): void {
    this.sound.nav();
    this.showPwd = !this.showPwd;
  }

  toggleConfirmPwd(): void {
    this.sound.nav();
    this.showConfirmPwd = !this.showConfirmPwd;
  }

  onInput(): void {
    this.sound.nav();
  }

  onToggle(v: boolean): void {
    this.sound.toggle2(v);
  }

  goSignin(): void {
    this.sound.nav();
    this.router.navigate(['/auth/signin']);
  }
}
