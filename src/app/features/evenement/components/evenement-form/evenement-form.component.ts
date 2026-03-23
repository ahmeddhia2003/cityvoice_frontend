import {
  Component, AfterViewInit,
  ElementRef, ViewChild, OnDestroy
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { EvenementService } from '../../services/evenement.service';
import { TypeEvenement } from '../../models/evenement.model';

@Component({
  selector: 'app-evenement-form',
  templateUrl: './evenement-form.component.html',
  styleUrls: ['./evenement-form.component.css']
})
export class EvenementFormComponent implements AfterViewInit, OnDestroy {

  @ViewChild('miniMap') miniMapEl!: ElementRef;

  form: FormGroup;
  types = Object.values(TypeEvenement);
  loading = false;
  erreur = '';
  succes = '';
  modePublication = false;

  private miniMap!: L.Map;
  private miniMarker!: L.Marker;

  constructor(
    private fb: FormBuilder,
    private evenementService: EvenementService,
    private router: Router
  ) {
    this.form = this.fb.group({
      titre:         ['', [Validators.required, Validators.minLength(3)]],
      description:   [''],
      type:          ['', Validators.required],
      dateDebut:     ['', Validators.required],
      dateFin:       [''],
      lieu:          ['', Validators.required],
      capaciteMax:   [null],
      estPayant:     [false],
      prix:          [null],
      organisateurId:[1, Validators.required],
      imageUrl:      [''],
      latitude:      [null],   // ➕
      longitude:     [null]    // ➕
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMiniMap(), 200);
  }

  ngOnDestroy(): void {
    if (this.miniMap) this.miniMap.remove();
  }

  // ─── Mini Map dans le formulaire ──────────────────────
  private initMiniMap(): void {
    if (!this.miniMapEl) return;

    this.miniMap = L.map(this.miniMapEl.nativeElement, {
      center: [36.8065, 10.1815],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(this.miniMap);

    // Fix icône Leaflet
    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = defaultIcon;

    // Clic sur la map → place le marker + met à jour les coords
    this.miniMap.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // Mettre à jour le formulaire
      this.form.patchValue({
        latitude:  parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lng.toFixed(6))
      });

      // Placer/déplacer le marker
      if (this.miniMarker) {
        this.miniMarker.setLatLng([lat, lng]);
      } else {
        this.miniMarker = L.marker([lat, lng]).addTo(this.miniMap);
      }

      this.miniMarker.bindPopup(
        `<b>Lat:</b> ${lat.toFixed(4)}<br><b>Lng:</b> ${lng.toFixed(4)}`
      ).openPopup();
    });

    // Si latitude/longitude changent manuellement → update marker
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

  // ─── Soumission ───────────────────────────────────────
  soumettre(): void {
    if (this.form.invalid) return;
    this.loading = true;

    this.evenementService.creerEvenement(this.form.value).subscribe({
      next: (ev) => {
        if (this.modePublication) {
          this.evenementService.publierEvenement(ev.id!).subscribe({
            next: () => {
              this.succes = `✅ Événement publié avec succès !`;
              this.loading = false;
              setTimeout(() => this.router.navigate(['/evenements']), 1500);
            }
          });
        } else {
          this.succes = `✅ Événement sauvegardé en brouillon`;
          this.loading = false;
          setTimeout(() => this.router.navigate(['/evenements']), 1500);
        }
      },
      error: () => {
        this.erreur = 'Erreur lors de la création';
        this.loading = false;
      }
    });
  }

  annuler(): void {
    this.router.navigate(['/evenements']);
  }
}