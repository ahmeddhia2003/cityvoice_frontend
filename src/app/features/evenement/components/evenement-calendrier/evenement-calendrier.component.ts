import { Component, OnInit, OnChanges } from '@angular/core';
import { Router } from '@angular/router';
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import frLocale from '@fullcalendar/core/locales/fr';
import { Evenement } from '../../models/evenement.model';
import { EvenementService } from '../../services/evenement.service';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-evenement-calendrier',
  templateUrl: './evenement-calendrier.component.html',
  styleUrls: ['./evenement-calendrier.component.css']
})
export class EvenementCalendrierComponent implements OnInit {

  evenements: Evenement[] = [];
  loading = false;
  calendarOptions: CalendarOptions = {};

  constructor(
    private router: Router,
    private evenementService: EvenementService,
    public sound: SoundService,
    public i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.chargerEvenements();
  }

  chargerEvenements(): void {
    this.loading = true;
    this.evenementService.getEvenements().subscribe({
      next: (data) => {
        this.evenements = data;
        this.initCalendar();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private initCalendar(): void {
    this.calendarOptions = {
      plugins: [
        dayGridPlugin,
        timeGridPlugin,
        interactionPlugin,
        listPlugin
      ],
      locale: frLocale,
      initialView: 'dayGridMonth',
      headerToolbar: {
        left:   'prev,next today',
        center: 'title',
        right:  'dayGridMonth,timeGridWeek,listWeek'
      },
      buttonText: {
        today: this.i18n.t('cal.btn.today'),
        month: this.i18n.t('cal.btn.month'),
        week:  this.i18n.t('cal.btn.week'),
        list:  this.i18n.t('cal.btn.list'),
      },
      events:           this.buildEvents(),
      eventClick:       this.onEventClick.bind(this),
      eventMouseEnter:  this.onEventHover.bind(this),
      eventMouseLeave:  this.onEventLeave.bind(this),
      height:           'auto',
      aspectRatio:      1.8,
      dayMaxEvents:     3,
      moreLinkText:     this.i18n.t('cal.more'),
      nowIndicator:     true,
      weekends:         true,
      editable:         false,
      selectable:       false,
      eventDisplay:     'block',
      eventTimeFormat: {
        hour:     '2-digit',
        minute:   '2-digit',
        meridiem: false
      }
    };
  }

  private buildEvents(): any[] {
    return this.evenements
      .filter(ev => ev.dateDebut)
      .map(ev => ({
        id:              String(ev.id),
        title:           ev.titre,
        start:           ev.dateDebut,
        end:             ev.dateFin || ev.dateDebut,
        backgroundColor: this.getEventColor(ev.type),
        borderColor:     this.getEventColor(ev.type),
        textColor:       '#ffffff',
        extendedProps: {
          lieu:        ev.lieu,
          type:        ev.type,
          statut:      ev.statut,
          estPayant:   ev.estPayant,
          prix:        ev.prix,
          nbInscrits:  ev.nbInscrits,
          capaciteMax: ev.capaciteMax
        }
      }));
  }

  private onEventClick(info: EventClickArg): void {
    this.sound.click(); 
    this.router.navigate(['/evenements', info.event.id]);
  }

  private onEventHover(info: any): void {
    info.el.style.transform  = 'scale(1.02)';
    info.el.style.transition = 'transform .15s ease';
    info.el.style.zIndex     = '10';
    info.el.style.cursor     = 'pointer';
  }

  private onEventLeave(info: any): void {
    info.el.style.transform = 'scale(1)';
    info.el.style.zIndex    = '';
  }

  private getEventColor(type: string): string {
    const colors: { [key: string]: string } = {
      SEMINAIRE: '#0C1F3F',
      EDUCATION: '#0D9B76',
      RECYCLAGE: '#0D9B76',
      BENEVOLE:  '#C9973E',
      PAYANT:    '#E8532A',
      AUTRE:     '#4A4A6A'
    };
    return colors[type] || '#0C1F3F';
  }

  retour(): void {
    this.sound.nav(); 
    this.router.navigate(['/evenements']);
  }
}