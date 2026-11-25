import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { PractisingPerson } from '../../models/person.model';
import { PeopleStore } from '../../store/people-store';
import { PeoplePage } from './people-page';

describe('PeoplePage', () => {
  const toastSpy = { show: vi.fn() };

  beforeEach(async () => {
    toastSpy.show.mockReset();
    await TestBed.configureTestingModule({
      imports: [PeoplePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        PeopleStore,
        { provide: ToastNotifier, useValue: toastSpy },
      ],
    }).compileComponents();
  });

  it('should render people directory search input and handle follow toggle feedback', async () => {
    const fixture = TestBed.createComponent(PeoplePage);
    const store = fixture.componentInstance.peopleStore;
    const person: PractisingPerson = {
      id: 'u-1',
      name: 'Amira',
      username: 'amira',
      initial: 'A',
      chipClass: 'avatar-chip-blue',
      languages: 'Speaks Arabic · Learning English',
      followedByMe: false,
    };

    vi.spyOn(store, 'toggleFollow').mockResolvedValue({ ok: true, followed: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[type="search"]')).toBeTruthy();

    await fixture.componentInstance.onFollowToggle(person);
    expect(toastSpy.show).toHaveBeenCalledWith('Following Amira.');
  });
});
