import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ============================================================
// INTERFACES
// ============================================================

export interface UserDto {
  id:               string;
  nom:              string;
  email:            string;
  telephone:        string;
  role:             string;
  points:           number;
  monthlyPoints:     number;
  gouvernorat:      string;
  ville:            string;
  codePostal:       string;
  dateInscription:  string;
  photo:            string;
  banned:           boolean;
  banReason:        string;
  loginStreak:      number;
  trustLevel:       string;
  emailVerified:    boolean;

  // ── Champs calculés ──────────────────────────────────
  statut: string;       // ACTIF | NOUVEAU | INCOMPLET | EN_ATTENTE_VERIFICATION | SUSPENDU
  civicIndex:       number;   // 0-100, -1 si non citoyen
  agentStatus:      string;   // DISPONIBLE | OCCUPE | EN_INTERVENTION | HORS_LIGNE

  // ── Online tracking ────────────────────────────────────
  lastSeenAt: string | null;
  isOnline: boolean;
}

export interface PageResponse<T> {
  content:       T[];
  totalElements: number;
  totalPages:    number;
  currentPage:   number;
}

export interface PointTransactionDto {
  id:          string;
  points:      number;
  reason:      string;
  description: string;
  createdAt:   string;
}

export interface BadgeDto {
  id:           string;
  code:         string;
  name:         string;
  description:  string;
  emoji:        string;
  category:     string;
  pointsReward: number;
  color:        string;
}

export interface UserBadgeDto {
  id:         string;
  badge:      BadgeDto;
  obtainedAt: string;
}

export interface TrustInfo {
  level:       string;
  label:       string;
  color:       string;
  icon:        string;
  minPts:      number;
  maxPts:      number;
  nextLabel:   string;
  progress:    number;
}

// churn
export interface ChurnPrediction {
  userId:              string;
  churnProbability:    number;
  riskLevel:           'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  daysUntilChurn:      number | null;
  riskFactors:         string[];
  retentionActions:    RetentionAction[];
  modelConfidence:     number;
}

export interface RetentionAction {
  action:         string;
  priority:       string;
  expectedImpact: string;
}

// ============================================================
// SERVICE
// ============================================================

@Injectable({ providedIn: 'root' })
export class UserService {

  // ============================================================
  // 1. PROPRIÉTÉS PRIVÉES
  // ============================================================

  private readonly URL = `${environment.apiUrl}/api/users`;


  // ============================================================
  // 2. CONSTRUCTEUR
  // ============================================================

  constructor(private http: HttpClient) {}


  // ============================================================
  // 3. MÉTHODES PUBLIQUES - CRUD DE BASE
  // ============================================================

  getAll(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.URL);
  }

  getById(id: string): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.URL}/${id}`);
  }

  update(id: string, data: Partial<UserDto> & { photo?: string }): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.URL}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.URL}/${id}`);
  }


  // ============================================================
  // 4. MÉTHODES PUBLIQUES - GESTION DES RÔLES & PERMISSIONS
  // ============================================================

  getByRole(role: string): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.URL}/by-role/${role}`);
  }

  updateRole(id: string, role: string): Observable<UserDto> {
    return this.http.patch<UserDto>(`${this.URL}/${id}/role`, { role });
  }

  ban(id: string, reason: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/ban`, { reason });
  }

  unban(id: string): Observable<any> {
    return this.http.patch(`${this.URL}/${id}/unban`, {});
  }


  // ============================================================
  // 5. MÉTHODES PUBLIQUES - PAGINATION & RECHERCHE
  // ============================================================

  getPaginated(page: number, size: number, search?: string, role?: string)
    : Observable<PageResponse<UserDto>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);
    if (search) params = params.set('search', search);
    if (role && role !== 'ALL') params = params.set('role', role);
    return this.http.get<PageResponse<UserDto>>(`${this.URL}/paginated`, { params });
  }


  // ============================================================
  // 6. MÉTHODES PUBLIQUES - PROFIL PUBLIC & BIOGRAPHIE
  // ============================================================

  getPublicProfile(userId: string): Observable<any> {
    return this.http.get(`${this.URL}/${userId}/public`);
  }

  generateBio(data: {
    nom: string; ville: string; gouvernorat: string;
    role: string; points: number; badges: number;
    streak: number; since: string;
  }): Observable<{ bio: string }> {
    return this.http.post<{ bio: string }>(
      `${environment.apiUrl}/api/ai/generate-bio`, data
    );
  }


  // ============================================================
  // 7. MÉTHODES PUBLIQUES - POINTS & LEADERBOARD
  // ============================================================

  getPoints(userId: string): Observable<PointTransactionDto[]> {
    return this.http.get<PointTransactionDto[]>(`${this.URL}/${userId}/points`);
  }

  addPoints(userId: string, points: number, reason: string): Observable<any> {
    return this.http.post(
      `${this.URL}/${userId}/points`,
      null,
      { params: { points: points.toString(), reason } }
    );
  }

  getLeaderboard(limit = 10): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.URL}/leaderboard?limit=${limit}`);
  }


  // ============================================================
  // 8. MÉTHODES PUBLIQUES - BADGES & RÉCOMPENSES
  // ============================================================

  getAllBadges(): Observable<BadgeDto[]> {
    return this.http.get<BadgeDto[]>(`${this.URL}/badges`);
  }

  getUserBadges(userId: string): Observable<UserBadgeDto[]> {
    return this.http.get<UserBadgeDto[]>(`${this.URL}/${userId}/badges`);
  }


  // ============================================================
  // 9. MÉTHODES PUBLIQUES - STATUT & ANALYSE COMPORTEMENT
  // ============================================================

  updateAgentStatus(userId: string, status: string): Observable<any> {
    return this.http.patch(`${this.URL}/${userId}/agent-status`, { status });
  }

  getBehaviorAnalysis(userId: string): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}/api/admin/users/${userId}/behavior-analysis`
    );
  }


  // ============================================================
  // 10. MÉTHODES PUBLIQUES - PRÉDICTION & ANALYSE ML (CHURN)
  // ============================================================

  getChurnPrediction(userId: string): Observable<ChurnPrediction> {
    return this.http.get<ChurnPrediction>(
      `${environment.apiUrl}/api/admin/users/${userId}/churn`
    );
  }

  getHighRiskUsers(): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}/api/admin/churn/high-risk`
    );
  }

  getUserSegment(userId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/api/admin/users/${userId}/segment`);
  }

  getUserAnomaly(userId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/api/admin/users/${userId}/anomaly`);
  }

  getCompleteMLAnalysis(userId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/api/admin/users/${userId}/ml-analysis`);
  }
}
