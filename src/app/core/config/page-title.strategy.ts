import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { APP_NAME } from './app-config';

@Injectable()
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18n);
  private readonly pageTitle = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const page = this.pageTitle();
      this.title.setTitle(
        page ? `${this.i18n.t(page)} · ${this.i18n.t(APP_NAME)}` : this.i18n.t(APP_NAME),
      );
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pageTitle.set(this.buildTitle(snapshot));
  }
}
