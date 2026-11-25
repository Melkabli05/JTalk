import { inject, InjectionToken, Service } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import {
  AppTitleConfig,
  DEFAULT_APP_TITLE_CONFIG,
  formatDocumentTitle,
} from './app-title.utils';

export const APP_TITLE_CONFIG = new InjectionToken<AppTitleConfig>('APP_TITLE_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_APP_TITLE_CONFIG,
});

/**
 * Centralized Angular TitleStrategy for all routes (CSR and SSR).
 * Formats static route titles and dynamic title resolvers consistently as `<Page> · Jtalk`
 * and exposes `setPageTitle()` for live in-page title updates (e.g., renaming an active room).
 */
@Service()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly config = inject(APP_TITLE_CONFIG);

  override updateTitle(routerState: RouterStateSnapshot): void {
    const resolvedTitle = this.buildTitle(routerState);
    this.setPageTitle(resolvedTitle);
  }

  setPageTitle(pageTitle: string | undefined | null): void {
    this.title.setTitle(formatDocumentTitle(pageTitle, this.config));
  }
}
