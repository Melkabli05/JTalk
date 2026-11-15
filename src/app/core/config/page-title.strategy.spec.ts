import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { I18n } from '@shared/utils/i18n/i18n.service';
import { PageTitleStrategy } from './page-title.strategy';

@Component({ selector: 'app-stub', template: '' })
class Stub {}

describe('PageTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', title: 'Home', component: Stub },
          { path: 'b', component: Stub },
        ]),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
      ],
    });
  });

  it('formats titles as "<page> · Jtalk" and falls back to the app name', async () => {
    const router = TestBed.inject(Router);
    const title = TestBed.inject(Title);

    await router.navigateByUrl('/a');
    TestBed.tick();
    expect(title.getTitle()).toBe('Home · Jtalk');

    await router.navigateByUrl('/b');
    TestBed.tick();
    expect(title.getTitle()).toBe('Jtalk');
  });

  it('translates the title, and follows a change of language without a navigation', async () => {
    const i18n = TestBed.inject(I18n);
    await TestBed.inject(Router).navigateByUrl('/a');
    TestBed.tick();

    await i18n.use('ar');
    TestBed.tick();
    expect(TestBed.inject(Title).getTitle()).toBe('الرئيسية · Jtalk');

    await i18n.use('en');
    TestBed.tick();
    expect(TestBed.inject(Title).getTitle()).toBe('Home · Jtalk');
  });
});
