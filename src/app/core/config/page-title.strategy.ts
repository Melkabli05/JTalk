import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { APP_NAME } from './app-config';

@Injectable()
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly pageTitle = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const page = this.pageTitle();
      this.title.setTitle(page ? `${page} · ${APP_NAME}` : APP_NAME);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pageTitle.set(this.buildTitle(snapshot));
  }
}
