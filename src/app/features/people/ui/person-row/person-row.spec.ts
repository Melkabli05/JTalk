import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PractisingPerson } from '../../models/person.model';
import { PersonRow } from './person-row';

describe('PersonRow', () => {
  const samplePerson: PractisingPerson = {
    id: 'p1',
    name: 'Amira',
    username: 'amira_lang',
    initial: 'A',
    chipClass: 'chip-a',
    languages: 'Speaks Arabic · Learning English',
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
    expect(fixture.nativeElement.textContent).toContain('Speaks Arabic · Learning English');

    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    btn?.click();
    expect(spy).toHaveBeenCalledWith(samplePerson);
  });
});
