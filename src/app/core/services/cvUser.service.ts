import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CandidatureEquipe } from './candidature.service';

export interface CvUser {
  id?: string;
  fileName?: string;
  fileType?: string;
  data?: Blob;
  candidature?: CandidatureEquipe;
  userId?:string
}

@Injectable({
  providedIn: 'root'
})
export class CvUserService {

  private baseUrl = `${environment.apiUrl}/personnel/cvuser`;

  constructor(private http: HttpClient) {}

  /**
   * 📤 Upload CV
   */
  uploadCV(candidatureId: string,idUser:string, file: File): Observable<CvUser> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', idUser);

    return this.http.post<CvUser>(
      `${this.baseUrl}/${candidatureId}`,
      formData
    );
  }
   hasApplied(candidatureId: string, userId: string): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.baseUrl}/${candidatureId}/hasApplied/${userId}`
    );
  }

  /**
   * 📥 Get CV by ID
   */
  getCV(cvId: string): Observable<CvUser> {
    return this.http.get<CvUser>(`${this.baseUrl}/${cvId}`);
  }

  /**
   * 📄 Get all CVs by candidature
   */
  getCVsByCandidature(candidatureId: string): Observable<CvUser[]> {
    return this.http.get<CvUser[]>(
      `${this.baseUrl}/candidature/${candidatureId}/cvs`
    );
  }

  /**
   * 🗑 Delete CV
   */
  deleteCV(cvId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${cvId}`);
  }

  /**
   * 🔄 Update CV
   */
  updateCV(cvId: string, file: File): Observable<CvUser> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.put<CvUser>(
      `${this.baseUrl}/${cvId}`,
      formData
    );
  }

  /**
   * 📥 Download CV (optionnel)
   */
  downloadCV(cvId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${cvId}`, {
      responseType: 'blob'
    });
  }
}
