import {
  Component, AfterViewInit,
  ElementRef, ViewChild, OnDestroy, OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import { EvenementService } from '../../services/evenement.service';
import { TypeEvenement } from '../../models/evenement.model';
import { SoundService } from '../../../../core/services/sound.service';
import { OcrService, OcrResult } from '../../../../core/services/ocr.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-evenement-form',
  templateUrl: './evenement-form.component.html',
  styleUrls: ['./evenement-form.component.css']
})
export class EvenementFormComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('miniMap') miniMapEl!: ElementRef;

  form: FormGroup;
  types = Object.values(TypeEvenement);
  loading = false;
  erreur = '';
  succes = '';

  isAdminMode = false;
  editId: number | null = null;
  get isEditMode(): boolean { return this.editId !== null; }

  private miniMap!: L.Map;
  private miniMarker!: L.Marker;
  // ocr
  ocrLoading = false;
  ocrErreur = '';
  langueAffiche = 'fr';
  langueSortie = 'fr';
  constructor(
    private fb: FormBuilder,
    private evenementService: EvenementService,
    private router: Router,
    private route: ActivatedRoute,
    public sound: SoundService,
    private ocrService: OcrService,
    public i18n: I18nService
  ) {
    this.form = this.fb.group({
      titre:          ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description:    ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]],
      type:           ['', Validators.required],
      dateDebut:      ['', [Validators.required, this.dateFutureValidator]],
      dateFin:        [''],
      lieu:           ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      capaciteMax:    [null, [Validators.min(10), Validators.max(10000)]],
      estPayant:      [false],
      prix:           [null, [Validators.min(0), Validators.max(999)]],
      organisateurId: [1, Validators.required],
      imageUrl:       ['', [Validators.pattern('https?://.+')]],
      latitude:       [null, [Validators.min(-90),  Validators.max(90)]],
      longitude:      [null, [Validators.min(-180), Validators.max(180)]],
      // Nouveaux champs
      typeLieu:       [''],
      zone:           [''],
      mediaPrevu:     [false],
      streamingPrevu: [false],
    }, { validators: this.dateFinValidator });
    // ➕ Son toggle quand l'utilisateur active/désactive "estPayant"
    this.form.get('estPayant')?.valueChanges.subscribe(val => {
      this.sound.toggle2(val);
    });
  }

  // ─── Date début doit être dans le futur ───────────────
  private dateFutureValidator(control: AbstractControl) {
    if (!control.value) return null;
    const dateChoisie = new Date(control.value);
    const maintenant  = new Date();
    if (dateChoisie <= maintenant) {
      return { datePasse: true };
    }
    return null;
  }

  // ─── Date fin doit être après date début ──────────────
  private dateFinValidator(form: AbstractControl) {
    const dateDebut = form.get('dateDebut')?.value;
    const dateFin   = form.get('dateFin')?.value;
    if (dateDebut && dateFin && new Date(dateFin) <= new Date(dateDebut)) {
      return { dateFin: true };
    }
    return null;
  }

  ngOnInit(): void {
    this.isAdminMode = this.router.url.includes('/admin/');

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = Number(id);
      this.chargerEvenement(this.editId);
    }

    this.route.queryParams.subscribe(params => {
      if (params['titre']) {
        this.form.patchValue({
          titre:       params['titre'],
          description: params['description'] || '',
          type:        params['type'] || '',
          lieu:        params['lieu'] || '',
          dateDebut:   params['date'] ? params['date'] + 'T09:00' : ''
        });
      }
    });
  }

  chargerEvenement(id: number): void {
    this.loading = true;
    this.evenementService.getEvenementById(id).subscribe({
      next: (ev) => {
        this.form.patchValue({
          titre:          ev.titre,
          description:    ev.description || '',
          type:           ev.type,
          dateDebut:      ev.dateDebut?.substring(0, 16),
          dateFin:        ev.dateFin?.substring(0, 16) || '',
          lieu:           ev.lieu,
          capaciteMax:    ev.capaciteMax || null,
          estPayant:      ev.estPayant,
          prix:           ev.prix || null,
          imageUrl:       ev.imageUrl || '',
          latitude:       ev.latitude || null,
          longitude:      ev.longitude || null,
          organisateurId: ev.organisateurId || 1,
          typeLieu:       ev.typeLieu       || '',
          zone:           ev.zone           || '',
          mediaPrevu:     ev.mediaPrevu     || false,
          streamingPrevu: ev.streamingPrevu || false,
        });
        this.loading = false;
        if (ev.latitude && ev.longitude) {
          setTimeout(() => this.updateMiniMarker(ev.latitude!, ev.longitude!), 500);
        }
      },
      error: () => {
        this.erreur = this.i18n.t('ev.form.err.load');
        this.loading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMiniMap(), 200);
  }

  ngOnDestroy(): void {
    if (this.miniMap) this.miniMap.remove();
  }

  private initMiniMap(): void {
    if (!this.miniMapEl) return;

    this.miniMap = L.map(this.miniMapEl.nativeElement, {
      center: [36.8065, 10.1815],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(this.miniMap);

    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41],
      popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = defaultIcon;

    this.miniMap.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      this.sound.nav();
      this.form.patchValue({
        latitude:  parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lng.toFixed(6))
      });
      if (this.miniMarker) {
        this.miniMarker.setLatLng([lat, lng]);
      } else {
        this.miniMarker = L.marker([lat, lng]).addTo(this.miniMap);
      }
      this.miniMarker.bindPopup(
        `<b>Lat:</b> ${lat.toFixed(4)}<br><b>Lng:</b> ${lng.toFixed(4)}`
      ).openPopup();
    });

    this.form.get('latitude')?.valueChanges.subscribe(lat => {
      const lng = this.form.get('longitude')?.value;
      if (lat && lng) this.updateMiniMarker(lat, lng);
    });
    this.form.get('longitude')?.valueChanges.subscribe(lng => {
      const lat = this.form.get('latitude')?.value;
      if (lat && lng) this.updateMiniMarker(lat, lng);
    });
  }

  private updateMiniMarker(lat: number, lng: number): void {
    if (!this.miniMap) return;
    if (this.miniMarker) {
      this.miniMarker.setLatLng([lat, lng]);
    } else {
      this.miniMarker = L.marker([lat, lng]).addTo(this.miniMap);
    }
    this.miniMap.setView([lat, lng], 13);
  }
  // ─── OCR ──────────────────────────────────────────────
  onAfficheUpload(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.sound.click();
    this.ocrLoading = true;
    this.ocrErreur = '';

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64 = e.target.result;
      this.ocrService.extractFromImage(
        base64,
        this.langueAffiche,
        this.langueSortie
      ).subscribe({
        next: (result: OcrResult) => {
          this.sound.success();
          this.ocrLoading = false;
          // Pré-remplir le formulaire
          this.form.patchValue({
            titre:       result.titre       || '',
            description: result.description || '',
            lieu:        result.lieu        || '',
            type:        result.type        || '',
            prix:        result.prix        || null,
            estPayant:   result.estPayant   || false,
            dateDebut:   result.dateDebut   ? result.dateDebut.substring(0, 16) : '',
            dateFin:        result.dateFin       ? result.dateFin.substring(0, 16) : '',
            typeLieu:       result.typeLieu      || '',
            zone:           result.zone          || '',
            mediaPrevu:     result.mediaPrevu    || false,
            streamingPrevu: result.streamingPrevu || false,
            capaciteMax: result.capaciteMax || null,
          });
        },
        error: () => {
          this.ocrLoading = false;
          this.ocrErreur = this.i18n.t('ev.form.err.ocr');
        }
      });
    };
    reader.readAsDataURL(file);
  }
  soumettre(): void {
    console.log('📤 Form value:', this.form.value);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // ← Ajouter ce log
      console.log('Form errors:', this.form.errors);
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        if (control?.invalid) {
          console.log(`Champ invalide: ${key}`, control.errors);
        }
      });
      this.erreur = this.i18n.t('ev.form.err.form');
      return;
    }
    this.sound.click();  
    this.loading = true;
    this.erreur = '';
    // Nettoyer les chaînes vides → null
    const payload = {
      ...this.form.value,
      typeLieu: this.form.value.typeLieu || null,
      zone:     this.form.value.zone     || null,
    };
    console.log('📦 Payload envoyé:', payload); 
    if (this.isEditMode) {
      this.evenementService.modifierEvenement(this.editId!, payload).subscribe({
        next: () => {
          this.sound.success(); 
          this.succes = this.i18n.t('ev.form.succes.modif');
          this.loading = false;
          setTimeout(() => this.retour(), 1500);
        },
        error: () => {
          this.erreur = this.i18n.t('ev.form.err.modif');
          this.loading = false;
        }
      });
    } else {
      this.evenementService.creerEvenement(payload).subscribe({
        next: () => {
          this.sound.success();  
          this.succes = this.i18n.t('ev.form.succes.creer');
          this.loading = false;
          setTimeout(() => this.retour(), 1500);
        },
        error: () => {
          this.erreur = this.i18n.t('ev.form.err.creer');
          this.loading = false;
        }
      });
    }
  }

  retour(): void {
    this.sound.nav(); 
    if (this.isAdminMode) {
      this.router.navigate(['/admin/evenements']);
    } else {
      this.router.navigate(['/evenements']);
    }
  }
}