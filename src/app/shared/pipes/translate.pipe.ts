import { Pipe, PipeTransform, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from "../../core/services/i18n.service"
/** Usage dans les templates : {{ 'hero.cta1' | t }} */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform, OnDestroy {
  private sub: Subscription;

  constructor(private i18n: I18nService, private cd: ChangeDetectorRef) {
    console.log('TRANSLATE PIPE LOADED');
    this.sub = this.i18n.lang$.subscribe(() => this.cd.markForCheck());
  }

  transform(key: string): string { return this.i18n.t(key); }

  ngOnDestroy(): void { this.sub.unsubscribe(); }
}
