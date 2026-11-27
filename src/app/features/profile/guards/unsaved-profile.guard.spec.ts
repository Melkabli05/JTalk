import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { vi } from 'vitest';
import { unsavedProfileGuard, type HasUnsavedProfileChanges } from './unsaved-profile.guard';

describe('unsavedProfileGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;
  const nextState = {} as RouterStateSnapshot;

  function configure(dialogResult: boolean | undefined): { openSpy: ReturnType<typeof vi.fn> } {
    const openSpy = vi.fn().mockReturnValue({
      afterClosed: () => of(dialogResult),
    } as MatDialogRef<unknown, boolean | undefined>);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialog, useValue: { open: openSpy } },
      ],
    });
    return { openSpy };
  }

  it('allows navigation immediately when there are no unsaved changes', () => {
    const { openSpy } = configure(false);
    const component: HasUnsavedProfileChanges = { hasUnsavedChanges: () => false };

    const result = TestBed.runInInjectionContext(() =>
      unsavedProfileGuard(component, route, state, nextState),
    );

    expect(result).toBe(true);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('blocks navigation when dirty and the user chooses to stay', async () => {
    const { openSpy } = configure(false);
    const component: HasUnsavedProfileChanges = { hasUnsavedChanges: () => true };

    const result = TestBed.runInInjectionContext(() =>
      unsavedProfileGuard(component, route, state, nextState),
    );

    expect(openSpy).toHaveBeenCalledOnce();
    const resolved = isObservable(result) ? await firstValueFrom(result) : result;
    expect(resolved).toBe(false);
  });

  it('allows navigation when dirty and the user confirms leaving', async () => {
    const { openSpy } = configure(true);
    const component: HasUnsavedProfileChanges = { hasUnsavedChanges: () => true };

    const result = TestBed.runInInjectionContext(() =>
      unsavedProfileGuard(component, route, state, nextState),
    );

    expect(openSpy).toHaveBeenCalledOnce();
    const resolved = isObservable(result) ? await firstValueFrom(result) : result;
    expect(resolved).toBe(true);
  });
});
