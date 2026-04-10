import {
  Component, OnDestroy,
  Input, AfterViewInit, ElementRef, ViewChild
} from '@angular/core';
import * as L from 'leaflet';
import { Evenement } from '../../models/evenement.model';
import { I18nService } from '../../../../core/services/i18n.service';
@Component({
  selector: 'app-evenement-map',
  templateUrl: './evenement-map.component.html',
  styleUrls: ['./evenement-map.component.css']
})
export class EvenementMapComponent implements AfterViewInit, OnDestroy {

  @Input() evenement!: Evenement;
  @ViewChild('mapEl') mapEl!: ElementRef;

  private map!: L.Map;
  constructor(private i18n: I18nService) {}
  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  hasCoordinates(): boolean {
    return !!(this.evenement?.latitude && this.evenement?.longitude);
  }

  private initMap(): void {
    if (!this.hasCoordinates()) return;

    const lat = this.evenement.latitude!;
    const lng = this.evenement.longitude!;

    this.map = L.map(this.mapEl.nativeElement, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    L.Marker.prototype.options.icon = defaultIcon;

    const marker = L.marker([lat, lng], { icon: defaultIcon })
      .addTo(this.map);

    marker.bindPopup(`
      <div style="font-family:Arial,sans-serif;min-width:160px">
        <strong style="color:#0C1F3F;font-size:13px">
          ${this.evenement.titre}
        </strong>
        <p style="margin:6px 0 0;font-size:12px;color:#4A4A6A">
          📍 ${this.evenement.lieu}
        </p>
      </div>
    `).openPopup();

    L.circle([lat, lng], {
      color: '#E8532A',
      fillColor: '#E8532A',
      fillOpacity: 0.08,
      radius: 300,
      weight: 1.5
    }).addTo(this.map);
  }
}