import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AiService, AssistResponse, AnalyzeResponse } from '../../../core/services/ai.service';
import { SoundService } from '../../../core/services/sound.service';
import { CameraModalComponent } from '../../../shared/components/camera-modal/camera-modal.component';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
declare const gsap: any;
declare const L: any;
import { SignalementService } from '../../../core/services/signalement.service';
import { UserDto } from '../../../core/services/user.service';
export type GeoStatus   = 'idle' | 'loading' | 'success' | 'error';
export type VoiceStatus = 'idle' | 'listening' | 'done' | 'unsupported';
export type AiStatus    = 'idle' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-signaler-form',
  templateUrl: './signaler-form.component.html',
  styleUrls: ['./signaler-form.component.css'],
})
export class SignalerFormComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('pickMap') pickMapRef!: ElementRef;
  @ViewChild('cameraModal') cameraModalRef!: CameraModalComponent;
  doublon: any = null;
  showDoublonWarning = false;
  private map:        any;
  private marker:     any;
  private recognition: any;
  private volumeInterval: any;

  form!:       FormGroup;
  currentStep  = 1;
  totalSteps   = 3;
  submitted    = false;
  submitting   = false;

  /* Media */
  previewUrl:  string | null = null;
  previewType: 'image' | 'video' = 'image';
  previewB64:  string | null = null;
  cameraMode   = false;
  shutterFlash = false;

  /* Météo pré-sélection */
  weatherPreselectedType: { value: string; label: string; emoji: string } | null = null;

  /* GPS */
  geoStatus:  GeoStatus = 'idle';
  geoAddress  = '';

  /* Voice */
  voiceStatus: VoiceStatus = 'idle';
  waveHeights: number[]    = [4, 8, 4, 8, 4];

  /* IA - Aide optionnelle (étape 1) */
  aiStatus:    AiStatus = 'idle';
  aiSuggestion: AssistResponse | null = null;
  aiApplied    = false;

  /* IA - Résultat final (après soumission) */
  analyzeResult: AnalyzeResponse | null = null;
  submitError: string | null = null;

  /* Profil utilisateur connecté */
  userProfile: UserDto | null = null;

  typeOptions = [
    { value:'trou_chaussee',    label:'Trou dans la chaussée',   emoji:'🚧', color:'#E8532A' },
    { value:'lampadaire_casse', label:'Lampadaire cassé',         emoji:'💡', color:'#C9973E' },
    { value:'poteau_endommage', label:'Poteau endommagé',         emoji:'⚡', color:'#0D9B76' },
    { value:'fuite_eau',        label:"Fuite d'eau",              emoji:'💧', color:'#3B82F6' },
    { value:'dechets',          label:'Déchets non collectés',    emoji:'🗑️', color:'#6B7280' },
    { value:'signalisation',    label:'Signalisation',            emoji:'🚦', color:'#7C3AED' },
    { value:'caniveau',         label:'Caniveau bouché',          emoji:'🌊', color:'#0891B2' },
    { value:'autre',            label:'Autre problème',           emoji:'📌', color:'#9CA3AF' },
  ];

  stepDefs = [
    { name: 'Photo & Localisation', icon: '📍' },
    { name: 'Type & Description',   icon: '📝' },
    { name: 'Vos coordonnées',      icon: '👤' },
  ];

  priorites = ['Faible', 'Moyenne', 'Haute', 'Urgente'];

  constructor(
    private fb:          FormBuilder,
    private router:      Router,
    private route:       ActivatedRoute,
    private ngZone:      NgZone,
    private authService: AuthService,
    private ai:          AiService,
    private userService: UserService,
    private sigService:  SignalementService,
    public  sound:       SoundService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      /* Étape 1 */
      latitude:    [36.8065],
      longitude:   [10.1815],
      adresse:     ['', Validators.required],
      /* Étape 2 */
      type:        ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      priorite:    ['moyenne'],
      /* Étape 3 */
      anonyme:     [false],
      nom:         [''],
      email:       ['', Validators.email],
    });

    // ── Pré-sélection depuis la bannière météo (?type=xxx) ──────────────────
    const typeParam = this.route.snapshot.queryParamMap.get('type');
    if (typeParam) {
      const validType = this.typeOptions.find(t => t.value === typeParam);
      if (validType) {
        this.form.patchValue({ type: typeParam });
        this.weatherPreselectedType = validType; // afficher le hint sur étape 1
        // Rester sur l'étape 1 mais déclencher le GPS automatiquement
        // (l'utilisateur n'a qu'à confirmer la position et passer à l'étape 2)
        setTimeout(() => this.getLocation(), 400);
      }
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) this.voiceStatus = 'unsupported';

    // Pré-remplir nom/email depuis le profil de l'utilisateur connecté
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.userId) {
      this.userService.getById(currentUser.userId).subscribe({
        next: (profile) => {
          this.userProfile = profile;
          // Remplir uniquement si le mode anonyme est désactivé
          if (!this.form.get('anonyme')?.value) {
            this.form.patchValue({
              nom:   profile.nom   ?? '',
              email: profile.email ?? '',
            });
          }
        },
        error: () => {
          // Fallback : au moins l'email depuis le token
          if (currentUser.email) {
            this.form.patchValue({ email: currentUser.email });
          }
        },
      });
    }
  }

  ngAfterViewInit(): void {
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.form-wrapper', { opacity:0, y:30 }, { opacity:1, y:0, duration:.6, ease:'power2.out' });
    }
    setTimeout(() => this.initPickMap(), 300);
  }

  ngOnDestroy(): void {
    this.stopVoice();
    clearInterval(this.volumeInterval);
    if (this.map) this.map.remove();
  }

  /* ── Validation par étape ──────────────────────────── */
  canNext(): boolean {
    if (this.currentStep === 1) {
      return this.form.get('adresse')?.valid === true;
    }
    if (this.currentStep === 2) {
      return this.form.get('type')?.valid === true &&
             this.form.get('description')?.valid === true;
    }
    return true;
  }

  nextStep(): void {
    if (!this.canNext() || this.currentStep >= this.totalSteps) return;
    this.sound.nav();
    const prev = this.currentStep;
    this.currentStep++;
    this.animateStepper(prev, this.currentStep);
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.step-content', { opacity:0, x:48 }, { opacity:1, x:0, duration:.42, ease:'power3.out' });
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.sound.nav();
      const prev = this.currentStep;
      this.currentStep--;
      this.animateStepper(prev, this.currentStep);
      if (typeof gsap !== 'undefined') {
        gsap.fromTo('.step-content', { opacity:0, x:-48 }, { opacity:1, x:0, duration:.42, ease:'power3.out' });
      }
    }
  }

  private animateStepper(from: number, to: number): void {
    if (typeof gsap === 'undefined') return;

    // Animer la barre de progression
    const pct = ((to - 1) / (this.totalSteps - 1)) * 100;
    gsap.to('#stp-fill', {
      width: `${pct}%`,
      duration: .55,
      ease: 'power2.inOut',
    });

    // Step qui vient d'être complété → animation bounce
    if (to > from) {
      setTimeout(() => {
        const doneDot = document.querySelector(`#stp-${from} .stp-dot`);
        if (doneDot) {
          gsap.fromTo(doneDot,
            { scale: 1.4, backgroundColor: '#E8532A' },
            { scale: 1,   backgroundColor: '#0D9B76', duration: .5, ease: 'back.out(2)' }
          );
        }
      }, 50);
    }

    // Step actif → pulse halo
    setTimeout(() => {
      const activeDot = document.querySelector(`#stp-${to} .stp-dot`);
      if (activeDot) {
        gsap.fromTo(activeDot,
          { scale: .7, opacity: .6 },
          { scale: 1,  opacity: 1, duration: .45, ease: 'back.out(2.5)' }
        );
      }
      // Label actif → glisse vers le haut
      const activeLabel = document.querySelector(`#stp-${to} .stp-label-name`);
      if (activeLabel) {
        gsap.fromTo(activeLabel,
          { y: 6, opacity: 0 },
          { y: 0, opacity: 1, duration: .35, ease: 'power2.out', delay: .1 }
        );
      }
    }, 60);
  }

  /* ── Étape 1 : GPS ────────────────────────────────── */
  getLocation(): void {
    if (!navigator.geolocation) { this.geoStatus = 'error'; return; }
    this.geoStatus = 'loading';
    this.sound.nav();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.ngZone.run(() => {
          const { latitude: lat, longitude: lng } = pos.coords;
          this.form.patchValue({ latitude: lat, longitude: lng });
          this.geoStatus = 'success';
          this.sound.success();
          if (this.map && this.marker) {
            this.marker.setLatLng([lat, lng]);
            this.map.setView([lat, lng], 16);
          }
          this.reverseGeocode(lat, lng);
        });
      },
      () => { this.ngZone.run(() => { this.geoStatus = 'error'; this.sound.toggle2(false); }); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private initPickMap(): void {
    if (typeof L === 'undefined' || !this.pickMapRef || this.map) return;
    const lat = this.form.get('latitude')?.value ?? 36.8065;
    const lng = this.form.get('longitude')?.value ?? 10.1815;

    this.map = L.map(this.pickMapRef.nativeElement, { center:[lat,lng], zoom:13 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:'© CARTO', maxZoom:19,
    }).addTo(this.map);

    const icon = L.divIcon({
      html:`<div style="width:22px;height:22px;border-radius:50%;background:var(--coral,#E8532A);border:3px solid white;box-shadow:0 3px 14px rgba(232,83,42,.5)"></div>`,
      iconSize:[22,22], iconAnchor:[11,11], className:'',
    });
    this.marker = L.marker([lat,lng], { icon, draggable:true }).addTo(this.map);

    this.map.on('click', (e:any) => {
      this.marker.setLatLng(e.latlng);
      this.ngZone.run(() => {
        this.form.patchValue({ latitude:e.latlng.lat, longitude:e.latlng.lng });
        this.reverseGeocode(e.latlng.lat, e.latlng.lng);
      });
    });
    this.marker.on('dragend', (e:any) => {
      const {lat,lng} = e.target.getLatLng();
      this.ngZone.run(() => {
        this.form.patchValue({ latitude:lat, longitude:lng });
        this.reverseGeocode(lat, lng);
      });
    });
    setTimeout(() => { try { if (this.map && this.map._loaded) this.map.invalidateSize(); } catch(_){} }, 200);
  }

  private reverseGeocode(lat:number, lng:number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then(r => r.json())
      .then(data => {
        this.ngZone.run(() => {
          const d = data.address;
          const addr = [d.road||d.pedestrian, d.suburb, d.city||d.town].filter(Boolean).join(', ');
          this.geoAddress = addr || data.display_name?.split(',').slice(0,3).join(', ');
          this.form.patchValue({ adresse: this.geoAddress });
        });
      }).catch(() => {});
  }

  /* ── Étape 1 : Media & Caméra ─────────────────────── */
  triggerFileInput(): void {
    (document.getElementById('media-input') as HTMLInputElement)?.click();
  }

  /** Ouvre la modal caméra */
  openCameraModal(): void {
    this.playShutterAnimation(() => {
      this.cameraModalRef?.open();
    });
  }

  onCameraCapture(dataUrl: string): void {
    this.previewUrl = dataUrl;
    this.previewB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    this.sound.success();
    if (typeof gsap !== 'undefined') {
      setTimeout(() => {
        gsap.fromTo('#media-preview-wrap',
          { opacity:0, scale:.88, y:14 },
          { opacity:1, scale:1,   y:0, duration:.5, ease:'back.out(1.6)' }
        );
      }, 30);
    }
  }

  onCameraClose(): void {}

  /** Ouvre la caméra avec animation obturateur */
  openShutter(): void {
    this.sound.click();
    this.playShutterAnimation(() => {
      (document.getElementById('camera-input') as HTMLInputElement)?.click();
    });
  }

  /** Animation obturateur GSAP — 4 phases */
  private playShutterAnimation(onComplete: () => void): void {
    if (typeof gsap === 'undefined') { onComplete(); return; }
    const tl = gsap.timeline();

    // Phase 1 : lames se ferment
    tl.to('.blade', {
      scaleY: 0, transformOrigin: 'top center',
      duration: .18, stagger: .025, ease: 'power2.in',
    })
    // Phase 2 : flash + zoom lentille
    .call(() => { this.ngZone.run(() => { this.shutterFlash = true; }); })
    .to('.shutter-lens', { scale: 1.3, duration: .1, ease: 'power2.out' }, '<')
    // Phase 3 : flash s'estompe → ouvrir la caméra
    .to('#shutter-flash', {
      opacity: 0, duration: .22, ease: 'power2.out',
      onComplete: () => {
        this.ngZone.run(() => { this.shutterFlash = false; });
        onComplete();
      }
    }, '+=.06')
    // Phase 4 : lames se rouvrent
    .to('.blade', {
      scaleY: 1, transformOrigin: 'top center',
      duration: .22, stagger: .02, ease: 'power2.out',
    }, '-=.1')
    .to('.shutter-lens', { scale: 1, duration: .2, ease: 'back.out(2)' }, '<');
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.previewType = file.type.startsWith('video') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = e => {
      const full  = e.target?.result as string;
      this.previewUrl = full;
      this.previewB64 = full.includes(',') ? full.split(',')[1] : full;
      this.sound.success();
      if (typeof gsap !== 'undefined') {
        setTimeout(() => {
          gsap.fromTo('#media-preview-wrap',
            { opacity:0, scale:.88, y:14 },
            { opacity:1, scale:1,   y:0, duration:.5, ease:'back.out(1.6)' }
          );
        }, 30);
      }
    };
    reader.readAsDataURL(file);
  }

  removePreview(): void {
    const doRemove = () => {
      this.previewUrl = null; this.previewB64 = null;
      ['media-input','camera-input'].forEach(id => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) el.value = '';
      });
    };
    if (typeof gsap !== 'undefined') {
      gsap.to('#media-preview-wrap', {
        opacity:0, scale:.92, y:8, duration:.25, ease:'power2.in',
        onComplete: () => { this.ngZone.run(doRemove); }
      });
    } else { doRemove(); }
    this.sound.nav();
  }

  /* ── Compression image pour l'IA (Canvas, max 600px, JPEG 70%) ── */
  private compressImageForAI(b64: string): Promise<string> {
    return new Promise((resolve) => {
      try {
        const img  = new Image();
        img.onload = () => {
          const MAX  = 600;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            const ratio = Math.min(MAX / w, MAX / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(b64); return; }
          ctx.drawImage(img, 0, 0, w, h);
          // Extraire seulement la partie base64 (sans le prefix data:...)
          const dataUrl    = canvas.toDataURL('image/jpeg', 0.70);
          const compressed = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          resolve(compressed);
        };
        img.onerror = () => resolve(b64);
        // Construire la src correctement si b64 n'a pas déjà le prefix
        img.src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
      } catch {
        resolve(b64);
      }
    });
  }

  /* ── Étape 1 : Bouton Aide IA ─────────────────────── */
  async callAiAssist(): Promise<void> {
    const lat = this.form.get('latitude')?.value;
    const lng = this.form.get('longitude')?.value;
    // Envoyer la description partielle si l'utilisateur a déjà commencé à taper
    const descPartielle = (this.form.get('description')?.value || '').trim();

    this.aiStatus     = 'loading';
    this.aiSuggestion = null;
    this.aiApplied    = false;
    this.sound.click();

    // Compression de l'image avant envoi (réduit la taille du payload)
    let imageB64: string | undefined = undefined;
    if (this.previewB64) {
      imageB64 = await this.compressImageForAI(this.previewB64);
    }

    this.ai.assist({
      latitude:         lat,
      longitude:        lng,
      image_base64:     imageB64,
      description_user: descPartielle,
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.aiSuggestion = res;
          this.aiStatus     = 'ready';
          this.sound.success();
          if (typeof gsap !== 'undefined') {
            gsap.fromTo('.ai-result-panel',
              { opacity:0, y:14, scale:.97 },
              { opacity:1, y:0, scale:1, duration:.45, ease:'back.out(1.6)' }
            );
          }
        });
      },
      error: () => {
        this.ngZone.run(() => { this.aiStatus = 'error'; this.sound.toggle2(false); });
      },
    });
  }

  /** Applique toutes les suggestions et passe automatiquement à l'étape 2 */
  applyAndNext(): void {
    if (!this.aiSuggestion) return;
    this.applyAiSuggestion();
    // Vérifier que l'adresse est renseignée avant de passer à l'étape 2
    if (!this.canNext()) {
      this.form.get('adresse')?.markAsTouched();
      return;
    }
    setTimeout(() => { this.currentStep = 2; this.sound.nav(); }, 300);
  }

  applyAiSuggestion(): void {
    if (!this.aiSuggestion) return;
    this.sound.success();
    const typeMap: Record<string,string> = {
      trou_chaussee:'trou_chaussee', lampadaire_casse:'lampadaire_casse',
      poteau_endommage:'poteau_endommage', fuite_eau:'fuite_eau',
      dechets_non_collectes:'dechets', signalisation_manquante:'signalisation',
      caniveau_bouche:'caniveau', espace_vert_degrade:'autre',
    };
    this.form.patchValue({
      type:        typeMap[this.aiSuggestion.type_suggere] ?? 'autre',
      description: this.aiSuggestion.description_amelioree,
      priorite:    this.aiSuggestion.priorite_suggere,
    });
    this.aiApplied = true;
  }

  dismissAi(): void { this.aiSuggestion = null; this.aiStatus = 'idle'; this.sound.nav(); }

  /* ── Toggle anonyme avec restauration du profil ─── */
  toggleAnonyme(): void {
    const current = this.form.get('anonyme')?.value;
    const goingAnon = !current;
    this.form.patchValue({ anonyme: goingAnon });
    this.sound.toggle2(!goingAnon);

    if (goingAnon) {
      // Mode anonyme activé → vider nom et email
      this.form.patchValue({ nom: '', email: '' });
    } else {
      // Mode anonyme désactivé → restaurer depuis le profil
      if (this.userProfile) {
        this.form.patchValue({
          nom:   this.userProfile.nom   ?? '',
          email: this.userProfile.email ?? '',
        });
      } else {
        // Fallback sur l'email du token si profil pas encore chargé
        const u = this.authService.getCurrentUser();
        if (u?.email) this.form.patchValue({ email: u.email });
      }
    }
  }

  /* ── Étape 2 : Voice ──────────────────────────────── */
  toggleVoice(): void { this.voiceStatus === 'listening' ? this.stopVoice() : this.startVoice(); }

  private startVoice(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { this.voiceStatus = 'unsupported'; return; }
    this.recognition = new SR();
    this.recognition.lang = 'fr-FR';
    this.recognition.interimResults = true;
    this.recognition.continuous = false;
    this.voiceStatus = 'listening';
    this.recognition.onresult = (event:any) => {
      this.ngZone.run(() => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
        }
        if (final) {
          const cur = this.form.get('description')?.value || '';
          this.form.patchValue({ description: cur + (cur.trim() ? ' ' : '') + final.trim() });
          this.voiceStatus = 'done';
          setTimeout(() => { if (this.voiceStatus==='done') this.voiceStatus='idle'; }, 1800);
        }
      });
    };
    this.recognition.onerror  = (e:any) => { this.ngZone.run(() => { this.voiceStatus = e.error==='not-allowed'?'unsupported':'idle'; }); };
    this.recognition.onend    = ()      => { this.ngZone.run(() => { clearInterval(this.volumeInterval); if (this.voiceStatus==='listening') this.voiceStatus='idle'; }); };
    this.recognition.start();
    this.volumeInterval = setInterval(() => {
      this.ngZone.run(() => { this.waveHeights = [1,2,3,4,5].map(() => Math.round(3+Math.random()*13)); });
    }, 120);
  }

  private stopVoice(): void {
    try { this.recognition?.stop(); } catch {}
    clearInterval(this.volumeInterval);
    this.voiceStatus = 'idle';
  }

  /* ── Submit ───────────────────────────────────────── */
   private _pendingTypeMap: Record<string, string> = {};
  onSubmit(): void {
    if (this.submitting) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.get('adresse')?.invalid) {
        this.submitError = "Veuillez renseigner une adresse (étape 1) avant d'envoyer.";
      } else if (this.form.get('type')?.invalid) {
        this.submitError = "Veuillez choisir un type de problème (étape 2).";
      } else if (this.form.get('description')?.invalid) {
        this.submitError = "La description est trop courte (10 caractères min.).";
      } else {
        this.submitError = "Formulaire incomplet. Vérifiez les champs obligatoires.";
      }
      return;
    }
    this.submitting = true;
    this.sound.click();

    const typeMap: Record<string, string> = {
      trou_chaussee:    'TROU_CHAUSSEE',
      lampadaire_casse: 'LAMPADAIRE_CASSE',
      fuite_eau:        'FUITE_EAU',
      dechets:          'DECHETS_NON_COLLECTES',
      poteau_endommage: 'POTEAU_ENDOMMAGE',
      signalisation:    'SIGNALISATION_MANQUANTE',
      caniveau:         'CANIVEAU_BOUCHE',
      autre:            'AUTRE',
    };
    this._pendingTypeMap = typeMap;

    const lat  = this.form.get('latitude')?.value;
    const lng  = this.form.get('longitude')?.value;
    const type = typeMap[this.form.get('type')?.value] ?? 'AUTRE';

    this.sigService.checkDoublon(lat, lng, type).subscribe({
      next: (res) => {
        if (res.hasDoublon) {
          this.doublon           = res.signalement;
          this.showDoublonWarning = true;
          this.submitting        = false;
        } else {
          this.doSubmit(typeMap);
        }
      },
      error: () => this.doSubmit(typeMap), /* En cas d'erreur doublon, on soumet quand même */
    });
  }

  doSubmit(typeMap: Record<string, string>): void {
    this.submitting = true;

    // Clés en minuscule ET en majuscule initiale pour couvrir les deux cas
    const prioMap: Record<string, string> = {
      faible:'FAIBLE',  Faible:'FAIBLE',
      moyenne:'MOYENNE', Moyenne:'MOYENNE',
      haute:'HAUTE',    Haute:'HAUTE',
      urgente:'URGENTE', Urgente:'URGENTE',
    };

    const rawPrio = (this.form.get('priorite')?.value ?? 'moyenne') as string;
    const prioriteCitoyen = prioMap[rawPrio] ?? prioMap[rawPrio.toLowerCase()] ?? 'MOYENNE';

    const request = {
      type:            typeMap[this.form.get('type')?.value] ?? 'AUTRE',
      description:     this.form.get('description')?.value,
      latitude:        this.form.get('latitude')?.value,
      longitude:       this.form.get('longitude')?.value,
      adresse:         this.form.get('adresse')?.value,
      prioriteCitoyen,
      estAnonyme:      this.form.get('anonyme')?.value ?? false,
      imageBase64:     this.previewB64 ?? undefined,
    };

    const currentUser = this.authService.getCurrentUser();
    const userId: string = currentUser?.userId ?? '1';

    /* ── toast d'erreur inline ─────────────────────────── */
    this.sigService.create(request, userId).subscribe({
      next: (sig) => {
        this.ngZone.run(() => {
          this.analyzeResult = {
            categorie:      sig.type?.toLowerCase() ?? '',
            // Toujours afficher la priorité choisie par le citoyen — jamais la valeur IA
            priorite:       sig.prioriteCitoyen?.toLowerCase() ?? 'moyenne',
            priorite_score: 2,
            equipe:         sig.equipeIA ?? '',
            equipe_label:   sig.equipeIALabel ?? this._labelFromType(sig.type) ?? 'Affectation en cours',
            delai_heures:   sig.delaiEstimeHeures ?? 48,
            confidences:    { categorie: sig.confidenceIA ?? 0.85 },
            processing_ms:  0,
          };
          this.submitting = false;
          this.submitted  = true;
          const auth = this.authService.getCurrentUser();
if (auth?.userId) {
  this.userService.addPoints(auth.userId, 20, 'SIGNALEMENT_SOUMIS').subscribe({
    next: () => {
      this.authService.refreshAuthState();
    },
    error: () => { /* Points non critiques, on ignore silencieusement */ }
  });
}
          this.sound.success();

          setTimeout(() => {
            if (typeof gsap === 'undefined') return;

            gsap.set('.success-card',    { opacity:0, scale:.7, y:40 });
            gsap.set('.success-title',   { opacity:0, y:12 });
            gsap.set('.success-sub',     { opacity:0, y:12 });
            gsap.set('.ai-result-card',  { opacity:0 });
            gsap.set('.air-item',        { opacity:0, y:8 });
            gsap.set('.success-actions', { opacity:0, y:12 });
            gsap.set('.check-circle',    { strokeDashoffset: 60 });
            gsap.set('.check-mark',      { strokeDashoffset: 20 });

            const cx     = window.innerWidth / 2;
            const cy     = window.innerHeight / 2;
            const colors = ['#E8532A','#0D9B76','#C9973E','#0C1F3F','#3B82F6'];
            const particles: HTMLElement[] = [];
            for (let i = 0; i < 50; i++) {
              const p    = document.createElement('div');
              const size = Math.random() * 9 + 4;
              p.style.cssText = `
                position:fixed; width:${size}px; height:${size}px;
                background:${colors[Math.floor(Math.random()*colors.length)]};
                border-radius:${Math.random()>.5?'50%':'2px'};
                left:${cx}px; top:${cy}px; opacity:0;
                pointer-events:none; z-index:9999;
              `;
              document.body.appendChild(p);
              particles.push(p);
            }

            const tl = gsap.timeline({ onComplete: () => particles.forEach(p => p.remove()) });

            tl.to('.ripple-1', { scale:5, opacity:.5, duration:.4, ease:'power2.out' }, 0)
              .to('.ripple-1', { opacity:0, duration:.3 }, .3)
              .to('.ripple-2', { scale:4, opacity:.3, duration:.6, ease:'power2.out' }, .1)
              .to('.ripple-2', { opacity:0, duration:.4 }, .5)
              .to('.success-card', { opacity:1, scale:1, y:0, duration:.55, ease:'back.out(1.8)' }, .05)
              .to(particles, {
                opacity:1,
                x: () => (Math.random()-.5)*500,
                y: () => (Math.random()-.5)*400,
                rotation: () => Math.random()*720,
                duration:1.2, ease:'power3.out',
                stagger:{ each:.01, from:'random' }
              }, .1)
              .to(particles, { opacity:0, duration:.5, stagger:.01 }, .9)
              .to('.check-circle', { strokeDashoffset:0, duration:.6, ease:'power2.inOut' }, .35)
              .to('.check-mark',   { strokeDashoffset:0, duration:.4, ease:'power2.out' }, .8)
              .to('#success-icon-ring', { boxShadow:'0 0 0 10px rgba(13,155,118,.15)', duration:.3 }, .8)
              .to('#success-icon-ring', { boxShadow:'0 0 0 0px rgba(13,155,118,0)',    duration:.4 }, 1.1)
              .to('.success-title',   { opacity:1, y:0, duration:.4, ease:'power2.out' }, .65)
              .to('.success-sub',     { opacity:1, y:0, duration:.3, ease:'power2.out' }, .78)
              .to('.ai-result-card',  { opacity:1, duration:.35 }, .9)
              .to('.air-item', { opacity:1, y:0, duration:.3, ease:'back.out(1.4)', stagger:.08 }, 1.0)
              .to({}, {
                duration: .9,
                onUpdate: function() {
                  const p       = this.progress();
                  const delayH  = sig.delaiEstimeHeures ?? 48;
                  const confPct = Math.round((sig.confidenceIA ?? .85) * 100);
                  const d = document.querySelector('.delay-counter');
                  const c = document.querySelector('.conf-counter');
                  const f = document.getElementById('conf-fill-anim');
                  if (d) d.textContent = Math.round(p * delayH) + 'h';
                  if (c) c.textContent = Math.round(p * confPct) + '%';
                  if (f) (f as HTMLElement).style.width = Math.round(p * confPct) + '%';
                }
              }, 1.1)
              .to('.success-actions', { opacity:1, y:0, duration:.4, ease:'back.out(1.4)' }, 1.7);
          }, 50);
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.submitting  = false;
          this.submitError = "Impossible d'envoyer le signalement. Vérifiez votre connexion.";
          if (typeof gsap !== 'undefined') {
            setTimeout(() => {
              gsap.fromTo('.submit-error-banner',
                { opacity: 0, y: 8, scale: .97 },
                { opacity: 1, y: 0, scale: 1, duration: .35, ease: 'back.out(1.6)' }
              );
            }, 20);
          }
          this.sound.toggle2(false);
        });
      },
    });
  }

  confirmerDoublon(): void {
    this.showDoublonWarning = false;
    this.doublon = null;
    this.doSubmit(this._pendingTypeMap);
  }

  annulerDoublon(): void {
    this.showDoublonWarning = false;
    this.doublon = null;
    this.submitting = false;
  }

  voterDoublon(): void {
    if (!this.doublon?.id) return;
    this.sigService.voter(this.doublon.id).subscribe({
      next: () => {
        this.showDoublonWarning = false;
        this.doublon = null;
        this.router.navigate(['/signaler']);
      },
      error: () => { this.showDoublonWarning = false; }
    });
  }

  goHome(): void         { this.router.navigate(['/']); }
  goSignalements(): void { this.router.navigate(['/signaler']); }

  get selectedType()      { return this.typeOptions.find(t => t.value === this.form.get('type')?.value); }
  get descriptionLength() { return (this.form.get('description')?.value || '').length; }
  /** true si la confiance IA est trop faible pour appliquer automatiquement (< 40%) */
  get aiConfidenceLow():  boolean { return (this.aiSuggestion?.confidence ?? 1) < 0.40; }
  /** Pourcentage entier de confiance (0–100) */
  get aiConfidencePct():  number  { return Math.round((this.aiSuggestion?.confidence ?? 0) * 100); }
  /** Classe CSS selon le niveau de confiance */
  get aiConfidenceClass(): string {
    const c = this.aiSuggestion?.confidence ?? 0;
    if (c >= 0.75) return 'conf-high';
    if (c >= 0.45) return 'conf-med';
    return 'conf-low';
  }

  /** Dérive le label d'équipe depuis le type citoyen si equipeIALabel est null */
  _labelFromType(type: string | null | undefined): string | null {
    const map: Record<string, string> = {
      DECHETS_NON_COLLECTES:   'Équipe Propreté',
      TROU_CHAUSSEE:           'Équipe Voirie',
      SIGNALISATION_MANQUANTE: 'Équipe Voirie',
      CANIVEAU_BOUCHE:         'Équipe Assainissement',
      FUITE_EAU:               'Équipe Plomberie',
      LAMPADAIRE_CASSE:        'Équipe Éclairage',
      ECLAIRAGE_DEFAILLANT:    'Équipe Éclairage',
      POTEAU_ENDOMMAGE:        'Équipe Éclairage',
      ESPACE_VERT_DEGRADE:     'Équipe Espaces Verts',
    };
    return type ? (map[type.toUpperCase()] ?? null) : null;
  }

  prioriteLabel(p: string): string {
    return ({faible:'Faible', moyenne:'Moyenne', haute:'Haute', urgente:'Urgente'} as any)[p] ?? p;
  }
  delaiLabel(h: number): string {
    if (h < 24) return `${Math.round(h)}h`;
    const j = Math.round(h / 24);
    return j === 1 ? '1 jour' : `${j} jours`;
  }




  
}
