import {
  Component, HostListener, AfterViewInit,
  ElementRef, OnInit, OnDestroy
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LangService, Lang } from '../../../core/services/lang.service';
import {SoundService} from '../../../core/services/sound.service';
declare const gsap: any;

export interface Notification {
  id: number;
  type: 'resolved' | 'progress' | 'badge' | 'info';
  message: string;
  time: string;
  read: boolean;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  scrolled   = false;
  mobileOpen = false;
  notifsOpen = false;

  private sub!: Subscription;

  notifications: Notification[] = [
    { id:1, type:'resolved', message:'Votre signalement "Trou chaussée – Av. Bourguiba" a été résolu.', time:'il y a 2h', read:false },
    { id:2, type:'progress', message:'L\'équipe Voirie Nord a pris en charge votre signalement.',        time:'il y a 5h', read:false },
    { id:3, type:'badge',    message:'Vous avez obtenu le badge "Sentinelle de la ville" 🏅',            time:'hier',      read:false },
    { id:4, type:'info',     message:'Nouvel événement : Plantation d\'arbres – Parc El Menzah.',        time:'il y a 2j', read:true  },
    { id:5, type:'resolved', message:'Le lampadaire cassé rue de la Liberté a été réparé.',              time:'il y a 3j', read:true  },
  ];

  get unreadCount(): number { return this.notifications.filter(n => !n.read).length; }

  constructor(
    public lang: LangService,
    public sound: SoundService,
    private el: ElementRef
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    gsap.fromTo(
      this.el.nativeElement.querySelector('nav'),
      { y: -80, opacity: 0 },
      { y: 0, opacity: 1, duration: .8, ease: 'power3.out', delay: .3 }
    );
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  @HostListener('window:scroll')
  onScroll(): void { this.scrolled = window.scrollY > 50; }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.notifsOpen = false; this.mobileOpen = false; }

  toggleMobile(): void {
    this.sound.nav();
    this.mobileOpen = !this.mobileOpen;
  }

  toggleNotifs(): void {
    this.sound.nav();
    this.notifsOpen = !this.notifsOpen;
    if (this.notifsOpen && typeof gsap !== 'undefined') {
      setTimeout(() => {
        gsap.fromTo('.nd-item',
          { opacity:0, y:8 },
          { opacity:1, y:0, duration:.3, stagger:.05, ease:'power2.out' }
        );
      }, 10);
    }
  }

  readNotif(n: Notification): void { n.read = true; }

  markAllRead(e: Event): void {
    e.stopPropagation();
    this.notifications.forEach(n => n.read = true);
    this.sound.toggle2(true);
  }

  setLang(l: Lang): void {
    this.sound.nav();
    this.lang.switch(l);
  }

  toggleSound(): void {
    this.sound.toggle();
    // petit feedback visuel mais pas sonore si on vient de couper
    if (this.sound.isEnabled) this.sound.click();
  }

  onBtnClick(): void { this.sound.click(); }
}
