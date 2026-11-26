import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PwaService } from './pwa';

describe('PwaService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: MatSnackBar,
          useValue: { open: vi.fn(() => ({ onAction: () => of(undefined) })) },
        },
      ],
    });
  });

  it('tracks online/offline events and deferred install prompts', async () => {
    const pwa = TestBed.inject(PwaService);
    pwa.init();

    window.dispatchEvent(new Event('offline'));
    expect(pwa.isOnline()).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(pwa.isOnline()).toBe(true);

    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(installEvent);
    expect(installEvent.defaultPrevented).toBe(true);
    expect(pwa.canInstall()).toBe(true);

    let outcome: string | undefined;
    pwa.promptInstall((res) => {
      outcome = res;
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(outcome).toBe('accepted'));
    expect(pwa.canInstall()).toBe(false);
  });
});
