import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { from } from 'rxjs';
import { vi } from 'vitest';
import { provideNoopAuthForTests } from '../../../../core/auth/auth.providers';
import { IdentityStore } from '../../../../core/auth/identity';
import { ToastNotifier } from '../../../../core/services/toast-notifier';
import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  const toastSpy = { show: vi.fn() };
  const dialogSpy = {
    open: vi.fn(() => ({ afterClosed: () => from([true]) })),
  };

  beforeEach(async () => {
    toastSpy.show.mockReset();
    dialogSpy.open.mockClear();
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAuthForTests(),
        provideRouter([]),
        { provide: ToastNotifier, useValue: toastSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();
  });

  it('should switch tabs and invoke real IdentityStore.deleteAccount on confirmation', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    const identity = TestBed.inject(IdentityStore);
    const deleteSpy = vi.spyOn(identity, 'deleteAccount').mockResolvedValue({ ok: true });
    fixture.detectChanges();

    fixture.componentInstance.selectTab('edit');
    expect(fixture.componentInstance.selectedTabIndex()).toBe(1);

    await fixture.componentInstance.openDeleteDialog();
    expect(dialogSpy.open).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
