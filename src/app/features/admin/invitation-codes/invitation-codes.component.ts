import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { SoundService } from '../../../core/services/sound.service';
declare const gsap: any;

interface UsedByUser {
  id:    string;
  nom:   string;
  email: string;
  role:  string;
}

interface InvitationCode {
  id:               string;
  code:             string;
  role:             string;
  used:             boolean;
  expiresAt:        string;
  createdByAdminId: string;
  usedByUser:       UsedByUser | null;  // ← objet imbriqué
}

interface PageResponse {
  content:       InvitationCode[];
  totalElements: number;
  totalPages:    number;
  currentPage:   number;
}

@Component({
  selector: 'app-invitation-codes',
  templateUrl: './invitation-codes.component.html',
  styleUrls: ['./invitation-codes.component.css'],
})
export class InvitationCodesComponent implements OnInit {

  codes:         InvitationCode[] = [];
  loading        = true;
  generating     = false;
  selectedRole   = 'CHEF_EQUIPE';

  // Code généré — on freeze le rôle au moment de la génération
  generatedCode:     string | null = null;
  generatedCodeRole: string | null = null;  // ← rôle figé
  copied             = false;

  // Pagination
  currentPage  = 0;
  pageSize     = 10;
  totalPages   = 0;
  totalElements = 0;

  // Filtres
  filterRole   = '';
  filterStatus = '';

  // Suppression / révocation
  deleteConfirmId:   string | null = null;
  deleteError:       string | null = null;
  revokeConfirm:     string | null = null;

  readonly roles = [
    { key: 'CHEF_EQUIPE',   label: 'Chef d\'équipe',  color: '#3B82F6' },
    { key: 'MEMBRE_EQUIPE', label: 'Agent terrain',   color: '#C9973E' },
    { key: 'MODERATEUR',    label: 'Modérateur',      color: '#E8532A' },
  ];

  readonly statusOptions = [
    { key: '',        label: 'Tous les statuts' },
    { key: 'active',  label: 'Actifs' },
    { key: 'used',    label: 'Utilisés' },
    { key: 'expired', label: 'Expirés' },
  ];

  private readonly URL = `${environment.apiUrl}/api/admin/invitation-codes`;

  constructor(
    private http: HttpClient,
    public sound: SoundService,
  ) {}

  ngOnInit(): void { this.loadCodes(); }

  loadCodes(): void {
    this.loading = true;
    let params = new HttpParams()
      .set('page', this.currentPage)
      .set('size', this.pageSize);

    if (this.filterRole)   params = params.set('role',   this.filterRole);
    if (this.filterStatus) params = params.set('status', this.filterStatus);

    this.http.get<PageResponse>(this.URL, { params }).subscribe({
      next: (res) => {
        this.codes         = res.content;
        this.totalPages    = res.totalPages;
        this.totalElements = res.totalElements;
        this.loading       = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters(): void {
    this.currentPage = 0;
    this.loadCodes();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    this.loadCodes();
  }

  generate(): void {
    if (!this.selectedRole || this.generating) return;
    this.sound.click();
    this.generating    = false;
    this.generatedCode = null;
    this.generating    = true;

    // ← Freeze le rôle au moment du clic
    const roleAtGeneration = this.selectedRole;

    this.http.post<InvitationCode>(this.URL, { role: roleAtGeneration }).subscribe({
      next: (res) => {
        this.generating        = false;
        this.generatedCode     = res.code;
        this.generatedCodeRole = res.role;  // ← rôle figé depuis la réponse backend
        this.loadCodes();
        if (typeof gsap !== 'undefined') {
          setTimeout(() => {
            gsap.fromTo('.generated-box',
              { scale: .8, opacity: 0 },
              { scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.8)' }
            );
          }, 30);
        }
      },
      error: () => { this.generating = false; }
    });
  }

  copyCode(): void {
    if (!this.generatedCode) return;
    navigator.clipboard.writeText(this.generatedCode).then(() => {
      this.copied = true;
      this.sound.success();
      setTimeout(() => { this.copied = false; }, 2000);
    });
  }

  copyToClipboard(code: string): void {
    navigator.clipboard.writeText(code);
    this.sound.nav();
  }

  // ── Suppression ──────────────────────────────────────────
  confirmDelete(id: string): void {
    this.sound.nav();
    this.deleteConfirmId = id;
    this.deleteError     = null;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
    this.deleteError     = null;
  }

  doDelete(): void {
    if (!this.deleteConfirmId) return;
    this.http.delete<any>(`${this.URL}/${this.deleteConfirmId}`).subscribe({
      next: () => {
        this.deleteConfirmId = null;
        this.deleteError     = null;
        this.loadCodes();
      },
      error: (err) => {
        // 409 = code utilisé par un agent
        if (err.status === 409) {
          this.deleteError = err.error?.message ?? 'Ce code est utilisé par un agent.';
        } else {
          this.deleteError = 'Erreur lors de la suppression.';
        }
      }
    });
  }

  // ── Révocation ───────────────────────────────────────────
  confirmRevoke(code: string): void {
    this.sound.nav();
    this.revokeConfirm = code;
  }

  doRevoke(): void {
    if (!this.revokeConfirm) return;
    this.http.patch(`${this.URL}/${this.revokeConfirm}/revoke`, {}).subscribe({
      next: () => {
        this.revokeConfirm = null;
        this.loadCodes();
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  roleLabel(key: string): string {
    return this.roles.find(r => r.key === key)?.label ?? key;
  }

  roleColor(key: string): string {
    return this.roles.find(r => r.key === key)?.color ?? '#8888A8';
  }

  roleBg(key: string): string {
    const map: Record<string, string> = {
      CHEF_EQUIPE:   'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)',
      MODERATEUR:    'rgba(232,83,42,.1)',
    };
    return map[key] ?? 'rgba(136,136,168,.1)';
  }

  isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  trackByCode(_: number, c: InvitationCode): string { return c.id; }
}
