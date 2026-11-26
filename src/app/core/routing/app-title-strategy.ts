import { inject, Service } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_BRAND_NAME = 'Jtalk';
export const APP_DEFAULT_TITLE = 'Jtalk — Language Speaking Practice Rooms';
const TITLE_SUFFIX = ` · ${APP_BRAND_NAME}`;

export function formatDocumentTitle(pageTitle: string | undefined | null): string {
  const trimmed = pageTitle?.trim() ?? '';
  if (!trimmed) return APP_DEFAULT_TITLE;

  const lower = trimmed.toLowerCase();
  const brand = APP_BRAND_NAME.toLowerCase();
  if (lower === brand) return APP_BRAND_NAME;
  if (
    lower.endsWith(TITLE_SUFFIX.toLowerCase()) ||
    lower.startsWith(`${brand} — `) ||
    lower.startsWith(`${brand} - `) ||
    lower.startsWith(`${brand} · `)
  ) {
    return trimmed;
  }
  return `${trimmed}${TITLE_SUFFIX}`;
}

@Service()
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(routerState: RouterStateSnapshot): void {
    this.setPageTitle(this.buildTitle(routerState));
  }

  setPageTitle(pageTitle: string | undefined | null): void {
    this.title.setTitle(formatDocumentTitle(pageTitle));
  }
}
