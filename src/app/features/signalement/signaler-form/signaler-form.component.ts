import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AiService, AssistResponse, AnalyzeResponse } from '../../../core/services/ai.service';
import { SoundService } from '../../../core/services/sound.service';
import { CameraModalComponent } from '../../../shared/components/camera-modal/camera-modal.component';

declare const gsap: any;
declare const L: any;

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

  typeOptions = [
    { value:'trou_chaussee',    label:'Trou dans la chaussée',   emoji:'🕳️', color:'#E8532A' },
    { value:'lampadaire_casse', label:'Lampadaire cassé',         emoji:'💡', color:'#C9973E' },
    { value:'poteau_endommage', label:'Poteau endommagé',         emoji:'⚡', color:'#0D9B76' },
    { value:'fuite_eau',        label:"Fuite d'eau",              emoji:'💧', color:'#3B82F6' },
    { value:'dechets',          label:'Déchets non collectés',    emoji:'🗑️', color:'#6B7280' },
    { value:'signalisation',    label:'Signalisation manquante',  emoji:'🚦', color:'#7C3AED' },
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
    private fb:     FormBuilder,
    private router: Router,
    private ngZone: NgZone,
    private ai:     AiService,
    public  sound:  SoundService,
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

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) this.voiceStatus = 'unsupported';
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
    setTimeout(() => this.map.invalidateSize(), 200);
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

  /* ── Étape 1 : Bouton Aide IA ─────────────────────── */
  callAiAssist(): void {
    const lat = this.form.get('latitude')?.value;
    const lng = this.form.get('longitude')?.value;

    this.aiStatus     = 'loading';
    this.aiSuggestion = null;
    this.aiApplied    = false;
    this.sound.click();

    this.ai.assist({
      latitude:         lat,
      longitude:        lng,
      image_base64:     this.previewB64 ?? undefined,
      description_user: '',
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.aiSuggestion = res;
          this.aiStatus     = 'ready';
          this.sound.success();
          if (typeof gsap !== 'undefined') {
            gsap.fromTo('.ai-suggestion-panel',
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
  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    this.sound.click();

    setTimeout(() => {
      this.ai.analyze({
        description:  this.form.get('description')?.value,
        latitude:     this.form.get('latitude')?.value,
        longitude:    this.form.get('longitude')?.value,
        image_base64: this.previewB64 ?? undefined,
      }).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            this.analyzeResult = res;
            this.submitting    = false;
            this.submitted     = true;
            this.sound.success();
            if (typeof gsap !== 'undefined') {
              gsap.fromTo('.success-card', { opacity:0, scale:.92, y:24 }, { opacity:1, scale:1, y:0, duration:.6, ease:'back.out(1.4)' });
            }
          });
        },
        error: () => {
          this.ngZone.run(() => { this.submitting = false; this.submitted = true; this.sound.success(); });
        },
      });
    }, 1200);
  }

  goHome(): void         { this.router.navigate(['/']); }
  goSignalements(): void { this.router.navigate(['/signalements']); }

  get selectedType()      { return this.typeOptions.find(t => t.value === this.form.get('type')?.value); }
  get descriptionLength() { return (this.form.get('description')?.value || '').length; }

  prioriteLabel(p:string): string {
    return ({faible:'Faible',moyenne:'Moyenne',haute:'Haute',urgente:'Urgente'} as any)[p] ?? p;
  }
  delaiLabel(h:number): string {
    if (h < 24) return `${Math.round(h)}h`;
    const j = Math.round(h/24);
    return j === 1 ? '1 jour' : `${j} jours`;
  }
}
