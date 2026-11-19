import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { PageTitleStrategy } from './page-title.strategy';

@Component({ selector: 'app-stub', template: '' })
class Stub {}

describe('PageTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', title: 'Rooms', component: Stub },
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
    expect(title.getTitle()).toBe('Rooms · Jtalk');

    await router.navigateByUrl('/b');
    TestBed.tick();
    expect(title.getTitle()).toBe('Jtalk');
  });
});
