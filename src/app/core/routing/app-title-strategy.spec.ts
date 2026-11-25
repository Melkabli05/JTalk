import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { APP_DEFAULT_TITLE } from './app-title.utils';
import { AppTitleStrategy } from './app-title-strategy';

@Component({ template: '' })
class DummyRouteView {}

describe('AppTitleStrategy', () => {
  let router: Router;
  let title: Title;
  let strategy: AppTitleStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'rooms', title: 'Live rooms', component: DummyRouteView },
          { path: 'untitled', component: DummyRouteView },
        ]),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
      ],
    });

    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
    strategy = TestBed.inject(AppTitleStrategy);
  });

  it('formats static route titles with the brand suffix', async () => {
    await router.navigateByUrl('/rooms');
    expect(title.getTitle()).toBe('Live rooms · Jtalk');
  });

  it('falls back to the default app title when a route defines no title', async () => {
    await router.navigateByUrl('/untitled');
    expect(title.getTitle()).toBe(APP_DEFAULT_TITLE);
  });

  it('updates the document title consistently via setPageTitle', () => {
    strategy.setPageTitle('Morning Coffee');
    expect(title.getTitle()).toBe('Morning Coffee · Jtalk');

    strategy.setPageTitle('');
    expect(title.getTitle()).toBe(APP_DEFAULT_TITLE);
  });
});
