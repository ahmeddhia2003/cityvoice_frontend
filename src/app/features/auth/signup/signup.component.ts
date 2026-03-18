import {
  Component, OnInit, AfterViewInit,
  ElementRef, ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {SoundService} from '../../../core/services/sound.service';
declare const gsap: any;

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class SignupComponent implements OnInit, AfterViewInit {

  @ViewChild('photoInput') photoInputRef!: ElementRef<HTMLInputElement>;

  form!: FormGroup;
  showPwd    = false;
  loading    = false;
  success    = false;
  toast      = false;
  toastMsg   = '';

  /* ── Photo de profil ── */
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

  /** Initiales de l'utilisateur pour l'avatar par défaut */
  get initials(): string {
    const fn = this.form?.get('firstName')?.value || '';
    const ln = this.form?.get('lastName')?.value  || '';
    return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '?';
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    public sound: SoundService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName:  ['', Validators.required],
      email:     ['', [Validators.required, Validators.email]],
      password:  ['', [Validators.required, Validators.minLength(8)]],
      terms:     [false, Validators.requiredTrue],
    });
    this.form.get('password')?.valueChanges.subscribe(v => this.checkPwd(v));
  }

  ngAfterViewInit(): void {
    if (typeof gsap === 'undefined') return;
    const tl = gsap.timeline();
    tl
      .fromTo('.auth-left',  { x:-80, opacity:0 }, { x:0, opacity:1, duration:.8, ease:'power3.out' }, .1)
      .fromTo('.auth-logo',  { opacity:0, y:-16 }, { opacity:1, y:0, duration:.5 }, .3)
      .fromTo('.lt-word',    { y:'100%' },          { y:'0%', duration:.7, stagger:.08, ease:'power4.out' }, .4)
      .fromTo('.auth-desc',  { opacity:0, y:20 },   { opacity:1, y:0, duration:.5 }, .8)
      .fromTo('.stat-chip',  { opacity:0, scale:.85 }, { opacity:1, scale:1, duration:.4, stagger:.08, ease:'back.out(1.5)' }, 1.0)
      .fromTo('.auth-proof', { opacity:0 },            { opacity:1, duration:.4 }, 1.2)
      .fromTo('.auth-card',  { opacity:0, y:30 },      { opacity:1, y:0, duration:.7, ease:'power3.out' }, .5)
      .fromTo('.auth-pin-1', { opacity:0, x:20 },      { opacity:1, x:0, duration:.5, ease:'back.out(2)' }, 1.1)
      .fromTo('.auth-pin-2', { opacity:0, x:20 },      { opacity:1, x:0, duration:.5, ease:'back.out(2)' }, 1.3)
      .fromTo('.photo-zone', { opacity:0, scale:.8 },  { opacity:1, scale:1, duration:.5, ease:'back.out(1.8)' }, .7);

    gsap.to('.auth-pin-1', { y:-8, duration:3,   yoyo:true, repeat:-1, ease:'sine.inOut', delay:1.2 });
    gsap.to('.auth-pin-2', { y:-6, duration:3.5, yoyo:true, repeat:-1, ease:'sine.inOut', delay:1.8 });
    gsap.to('.auth-orb-1', { x:20, y:-20, duration:5, yoyo:true, repeat:-1, ease:'sine.inOut' });
    gsap.to('.auth-orb-2', { x:-15, y:15, duration:6, yoyo:true, repeat:-1, ease:'sine.inOut', delay:1 });
  }

  /* ── Photo handlers ─────────────────────────────────────── */

  triggerPhoto(): void {
    this.sound.click();
    this.photoInputRef.nativeElement.click();
  }

  onPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.photoError = '';

    /* Validation */
    if (!file.type.startsWith('image/')) {
      this.photoError = 'Fichier non valide. Choisissez une image (JPG, PNG, WEBP).';
      this.sound.toggle2(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError = 'Image trop lourde. Maximum 5 Mo.';
      this.sound.toggle2(false);
      return;
    }

    this.photoName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.photoPreview = e.target?.result as string;
      this.sound.success();
      /* Animate avatar reveal */
      if (typeof gsap !== 'undefined') {
        gsap.fromTo('.photo-preview',
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.8)' }
        );
        gsap.fromTo('.photo-check',
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)', delay: .25 }
        );
      }
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.sound.nav();
    this.photoPreview = null;
    this.photoName    = '';
    this.photoError   = '';
    /* Reset file input */
    if (this.photoInputRef?.nativeElement) {
      this.photoInputRef.nativeElement.value = '';
    }
  }

  /* ── Other handlers ─────────────────────────────────────── */

  private checkPwd(val: string): void {
    let score = 0;
    if (val.length >= 8)        score++;
    if (/[A-Z]/.test(val))      score++;
    if (/[0-9]/.test(val))      score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    this.pwdScore = score;
    const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
    const colors = ['#8888A8','#E8532A','#C9973E','#0D9B76','#0D9B76'];
    this.pwdLabel = score > 0 ? `Mot de passe ${labels[score]}` : 'Force du mot de passe';
    this.pwdColor = colors[score];
  }

  togglePwd():              void { this.sound.nav();       this.showPwd = !this.showPwd; }
  onInput():                void { this.sound.nav(); }
  onToggle(v: boolean):     void { this.sound.toggle2(v); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.sound.toggle2(false);
      gsap.to('.auth-submit', { x:[-6,6,-4,4,-2,2,0], duration:.4, ease:'none' });
      return;
    }
    this.sound.click();
    this.loading = true;
    setTimeout(() => {
      this.loading = false;
      this.success = true;
      this.sound.success();
      this.showToast('Compte créé avec succès 🎉');
      setTimeout(() => this.router.navigate(['/']), 1800);
    }, 1800);
  }

  goSignin(): void { this.sound.nav(); this.router.navigate(['/auth/signin']); }

  showToast(msg: string): void {
    this.toastMsg = msg; this.toast = true;
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.auth-toast', { opacity:0, y:30 }, { opacity:1, y:0, duration:.4, ease:'back.out(1.6)' });
      setTimeout(() => {
        gsap.to('.auth-toast', { opacity:0, y:30, duration:.35, ease:'power2.in',
          onComplete: () => { this.toast = false; }
        });
      }, 3000);
    }
  }
}
