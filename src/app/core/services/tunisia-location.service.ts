import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── API response structure ─────────────────────────────
interface ApiDelegation {
  Name: string;
  NameAr: string;
  Value: string;
  PostalCode: string;
  Latitude: number;
  Longitude: number;
}

interface ApiGovernorate {
  Name: string;
  NameAr: string;
  Value: string;
  Delegations: ApiDelegation[];
}

@Injectable({ providedIn: 'root' })
export class TunisiaLocationService {

  private readonly API_URL = `${environment.apiUrl}/api/locations/municipalities`;

  private allData: ApiGovernorate[] = [];
  private dataLoaded = false;

  constructor(private http: HttpClient) {}

  /**
   * Load all data (cached)
   */
  private loadAll(): Observable<ApiGovernorate[]> {
    if (this.dataLoaded && this.allData.length > 0) {
      return of(this.allData);
    }

    return this.http.get<ApiGovernorate[]>(this.API_URL).pipe(
      map(data => {
        this.allData = data || [];
        this.dataLoaded = true;
        console.log(`Loaded ${this.allData.length} governorates`);
        return this.allData;
      }),
      catchError((err) => {
        console.error('Failed to load location data:', err);
        return of([]);
      })
    );
  }

  /**
   * Get all governorate names
   */
  getGovernorates(): Observable<string[]> {
    return this.loadAll().pipe(
      map(data => {
        if (!data || data.length === 0) {
          return this.getFallbackGovernorates();
        }
        return data
          .map(g => this.formatName(g.Name))
          .sort((a, b) => a.localeCompare(b, 'fr'));
      }),
      catchError(() => of(this.getFallbackGovernorates()))
    );
  }

  /**
   * Get delegations (villes) by governorate name
   */
  getDelegations(governorateName: string): Observable<string[]> {
    return this.loadAll().pipe(
      map(data => {
        const gov = data.find(g =>
          g.Name.toLowerCase() === governorateName.toLowerCase() ||
          this.formatName(g.Name).toLowerCase() === governorateName.toLowerCase()
        );

        if (!gov || !gov.Delegations) return [];

        // Deduplicate after formatting
        const unique = [...new Set(
          gov.Delegations.map(d => this.formatName(d.Name))
        )];

        return unique.sort((a, b) => a.localeCompare(b, 'fr'));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Get postal code for a delegation
   */
  getPostalCode(governorateName: string, delegationName: string): Observable<string | null> {
    return this.loadAll().pipe(
      map(data => {
        const gov = data.find(g =>
          g.Name.toLowerCase() === governorateName.toLowerCase() ||
          this.formatName(g.Name).toLowerCase() === governorateName.toLowerCase()
        );

        if (!gov || !gov.Delegations) return null;

        const del = gov.Delegations.find(d =>
          d.Name.toLowerCase() === delegationName.toLowerCase() ||
          this.formatName(d.Name).toLowerCase() === delegationName.toLowerCase()
        );

        return del?.PostalCode || null;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Format name: "ARIANA VILLE" → "Ariana Ville"
   */
  private formatName(name: string): string {
    if (!name) return '';
    // Remove parenthetical details like "(Residence Kortoba)"
    const clean = name.replace(/\s*\(.*?\)\s*/g, '').trim();
    return clean
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Fallback governorates if API fails
   */
  private getFallbackGovernorates(): string[] {
    return [
      'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
      'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba',
      'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
      'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
    ];
  }
}
