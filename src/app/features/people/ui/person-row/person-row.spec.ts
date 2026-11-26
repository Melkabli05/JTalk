import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DiscoveredUserResponse } from '../../../../core/auth/auth.models';
import { PersonRow } from './person-row';

describe('PersonRow', () => {
  const samplePerson: DiscoveredUserResponse = {
    id: 'p1',
    displayName: 'Amira',
    username: 'amira_lang',
    avatarUrl: null,
    nativeLanguage: 'ar',
    followedByMe: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonRow],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should render person details and emit followToggle when Follow is clicked', () => {
    const fixture = TestBed.createComponent(PersonRow);
    fixture.componentRef.setInput('person', samplePerson);
    const spy = vi.fn();
    fixture.componentInstance.followToggle.subscribe(spy);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Amira');
    expect(fixture.nativeElement.textContent).toContain('@amira_lang');
    expect(fixture.nativeElement.textContent).toContain('Speaks Arabic');

    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    btn?.click();
    expect(spy).toHaveBeenCalledWith(samplePerson);
  });
});
