import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OcrResult {
  titre: string;
  description: string;
  lieu: string;
  dateDebut: string;
  dateFin?: string;
  type: string;
  typeLieu?: string;     
  zone?: string;   
  prix: number;
  estPayant: boolean;
  mediaPrevu?: boolean;  
  streamingPrevu?: boolean; 
  capaciteMax?: number;
  rawText: string;
}

@Injectable({ providedIn: 'root' })
export class OcrService {

  private apiUrl = 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  extractFromImage(
    imageBase64: string,
    langueAffiche: string,
    langueSortie: string
  ): Observable<OcrResult> {
    return this.http.post<OcrResult>(`${this.apiUrl}/extract`, {
      image: imageBase64,
      langue_affiche: langueAffiche,
      langue_sortie: langueSortie
    });
  }

  health(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}