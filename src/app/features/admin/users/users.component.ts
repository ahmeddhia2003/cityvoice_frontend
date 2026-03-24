import { Component, OnInit } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { UserService, UserDto, PageResponse } from '../../../core/services/user.service';
import { SoundService } from '../../../core/services/sound.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit {

  users:       UserDto[] = [];
  loading      = true;
  search       = '';
  selectedRole = 'ALL';
  roleCounts: Record<string, number> = {};

  // Pagination
  currentPage   = 0;
  pageSize      = 10;
  totalPages    = 0;
  totalElements = 0;

  // Suppression
  deleteConfirm: string | null = null;
  deleteLoading = false;

  // Détail
  selectedUser: UserDto | null = null;
  showDetail    = false;

  // Ban
  banConfirm:  string | null = null;
  banReason    = '';
  banLoading   = false;
  unbanConfirm: string | null = null;

  readonly roles = [
    'ALL', 'CITOYEN', 'CHEF_EQUIPE',
    'MEMBRE_EQUIPE', 'MODERATEUR'
  ];

  constructor(
    public sound: SoundService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.loadRoleCounts();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.userService.getPaginated(
      this.currentPage, this.pageSize,
      this.search || undefined,
      this.selectedRole !== 'ALL' ? this.selectedRole : undefined
    ).subscribe({
      next: (res) => {
        this.users         = res.content;
        this.totalPages    = res.totalPages;
        this.totalElements = res.totalElements;
        this.loading       = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.load();
  }

  setRole(role: string): void {
    this.sound.nav();
    this.selectedRole = role;
    this.currentPage  = 0;
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    this.load();
  }

  get pages(): number[] {
    const total = this.totalPages;
    const cur   = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);
    // Afficher max 7 pages autour de la page courante
    const pages: number[] = [];
    for (let i = Math.max(0, cur - 3); i <= Math.min(total - 1, cur + 3); i++) {
      pages.push(i);
    }
    return pages;
  }

  // ── Détail ───────────────────────────────────────────────
  viewUser(user: UserDto): void {
    this.sound.nav();
    this.selectedUser = user;
    this.showDetail   = true;
    this.deleteConfirm = null;
    this.banConfirm    = null;
  }

  closeDetail(): void {
    this.showDetail    = false;
    this.selectedUser  = null;
    this.deleteConfirm = null;
    this.banConfirm    = null;
  }

  // ── Suppression ──────────────────────────────────────────
  confirmDelete(id: string): void {
    this.sound.nav();
    this.deleteConfirm = id;
    this.banConfirm    = null;
  }

  cancelDelete(): void { this.deleteConfirm = null; }

  doDelete(): void {
    if (!this.deleteConfirm) return;
    this.deleteLoading = true;
    const id = this.deleteConfirm;

    this.userService.delete(id).subscribe({
      next: () => {
        this.deleteConfirm = null;
        this.deleteLoading = false;
        if (this.selectedUser?.id === id) this.closeDetail();
        this.load();
      },
      error: () => { this.deleteLoading = false; }
    });
  }

  // ── Ban ──────────────────────────────────────────────────
  confirmBan(id: string): void {
    this.sound.nav();
    this.banConfirm    = id;
    this.banReason     = '';
    this.deleteConfirm = null;
  }

  cancelBan(): void {
    this.banConfirm = null;
    this.banReason  = '';
  }

  doBan(): void {
    if (!this.banConfirm) return;
    this.banLoading = true;
    const id = this.banConfirm;
    const reason = this.banReason || 'Violation des conditions d\'utilisation';

    this.userService.ban(id, reason).subscribe({
      next: () => {
        this.banLoading = false;
        this.banConfirm = null;
        this.banReason  = '';
        // Mettre à jour localement
        const user = this.users.find(u => u.id === id);
        if (user) user.banned = true;
        if (this.selectedUser?.id === id) this.selectedUser.banned = true;
        this.load();
      },
      error: () => { this.banLoading = false; }
    });
  }

  confirmUnban(id: string): void {
    this.sound.nav();
    this.unbanConfirm = id;
  }

  doUnban(): void {
    if (!this.unbanConfirm) return;
    const id = this.unbanConfirm;

    this.userService.unban(id).subscribe({
      next: () => {
        this.unbanConfirm = null;
        const user = this.users.find(u => u.id === id);
        if (user) user.banned = false;
        if (this.selectedUser?.id === id) this.selectedUser.banned = false;
        this.load();
      }
    });
  }

  // ── Changer rôle ─────────────────────────────────────────
  changeRole(user: UserDto, role: string): void {
    this.userService.updateRole(user.id, role).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === user.id);
        if (idx !== -1) this.users[idx] = updated;
        if (this.selectedUser?.id === user.id) this.selectedUser = updated;
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  roleColor(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: '#0D9B76', CHEF_EQUIPE: '#3B82F6',
      MEMBRE_EQUIPE: '#C9973E', MODERATEUR: '#E8532A'
    };
    return map[role] ?? '#8888A8';
  }

  roleBg(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'rgba(13,155,118,.1)', CHEF_EQUIPE: 'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)', MODERATEUR: 'rgba(232,83,42,.1)',
    };
    return map[role] ?? 'rgba(136,136,168,.1)';
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'Citoyen', CHEF_EQUIPE: 'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain', MODERATEUR: 'Modérateur'
    };
    return map[role] ?? role;
  }

  initials(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  countByRole(role: string): number {
    return this.roleCounts[role] ?? 0;
  }
  // Add this method:
  loadRoleCounts(): void {
    this.userService.getPaginated(0, 1, undefined, undefined).subscribe({
      next: (res) => { this.roleCounts['ALL'] = res.totalElements; }
    });
    const roleList = ['CITOYEN', 'CHEF_EQUIPE', 'MEMBRE_EQUIPE', 'MODERATEUR'];
    roleList.forEach(role => {
      this.userService.getPaginated(0, 1, undefined, role).subscribe({
        next: (res) => { this.roleCounts[role] = res.totalElements; }
      });
    });
  }

  trackById(_: number, u: UserDto): string { return u.id; }
}
