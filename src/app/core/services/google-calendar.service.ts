import { Injectable } from '@angular/core';

declare var gapi: any;
declare var google: any;

@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {

  private CLIENT_ID = '332343470890-pms8917dccleg4a7hqdjaihb3486ptv4.apps.googleusercontent.com';
  private SCOPES    = 'https://www.googleapis.com/auth/calendar.events';
  private tokenClient: any;
  private accessToken: string | null = null;

  async init(): Promise<void> {
    return new Promise((resolve) => {
      gapi.load('client', async () => {
        await gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
        });
        resolve();
      });
    });
  }

  async getToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope:     this.SCOPES,
        callback:  (response: any) => {
          if (response.error) {
            reject(response.error);
            return;
          }
          this.accessToken = response.access_token;
          resolve(response.access_token);
        }
      });
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  async ajouterEvenement(evenement: any): Promise<string | null> {
    try {
      await this.init();
      const token = await this.getToken();
      gapi.client.setToken({ access_token: token });

      const debut = new Date(evenement.dateDebut).toISOString();
      const fin   = evenement.dateFin
        ? new Date(evenement.dateFin).toISOString()
        : new Date(new Date(evenement.dateDebut).getTime() + 2 * 60 * 60 * 1000).toISOString();

      const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: {
          summary:     evenement.titre,
          location:    evenement.lieu,
          description: `Événement CityVoice — ${evenement.estPayant ? evenement.prix + ' TND' : 'Gratuit'}`,
          start: { dateTime: debut, timeZone: 'Africa/Tunis' },
          end:   { dateTime: fin,   timeZone: 'Africa/Tunis' }
        }
      });

      return response.result.id;
    } catch (e: any) {
      console.error('Erreur Google Calendar:', e);
      return null;
    }
  }

  async modifierEvenement(googleEventId: string, evenement: any): Promise<void> {
    try {
      await this.init();
      if (!this.accessToken) await this.getToken();
      gapi.client.setToken({ access_token: this.accessToken });

      const debut = new Date(evenement.dateDebut).toISOString();
      const fin   = evenement.dateFin
        ? new Date(evenement.dateFin).toISOString()
        : new Date(new Date(evenement.dateDebut).getTime() + 2 * 60 * 60 * 1000).toISOString();

      await gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId:    googleEventId,
        resource: {
          summary:     evenement.titre,
          location:    evenement.lieu,
          description: `Événement CityVoice — ${evenement.estPayant ? evenement.prix + ' TND' : 'Gratuit'}`,
          start: { dateTime: debut, timeZone: 'Africa/Tunis' },
          end:   { dateTime: fin,   timeZone: 'Africa/Tunis' }
        }
      });
      console.log('✅ Google Calendar mis à jour');
    } catch (e) {
      console.error('Erreur mise à jour Google Calendar:', e);
    }
  }
}