import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return (
    'prompt' in event &&
    typeof Reflect.get(event, 'prompt') === 'function' &&
    'userChoice' in event
  );
}

function isStandaloneNavigator(nav: Navigator): boolean {
  return 'standalone' in nav && Reflect.get(nav, 'standalone') === true;
}

@Service()
export class PwaService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  private readonly isOnlineState = signal(true);
  private readonly isStandaloneState = signal(false);
  private readonly updateAvailableState = signal(false);
  private waitingWorker: ServiceWorker | null = null;
  private initialized = false;
  private reloadingForUpdate = false;

  readonly isOnline = this.isOnlineState.asReadonly();
  readonly isStandalone = this.isStandaloneState.asReadonly();
  readonly updateAvailable = this.updateAvailableState.asReadonly();

  readonly canInstall = computed(() => !this.isStandalone() && this.deferredPrompt() !== null);
  readonly isIosInstallable = computed(() => {
    if (!isPlatformBrowser(this.platformId) || this.isStandalone() || this.canInstall()) {
      return false;
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIos && isSafari;
  });

  init(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) return;
    this.initialized = true;

    const win = this.document.defaultView;
    if (!win) return;

    this.isOnlineState.set(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const standaloneMedia =
      typeof win.matchMedia === 'function'
        ? win.matchMedia('(display-mode: standalone)')
        : null;
    const navStandalone = typeof navigator !== 'undefined' && isStandaloneNavigator(navigator);
    this.isStandaloneState.set(Boolean(standaloneMedia?.matches || navStandalone));

    const onOnline = (): void => this.isOnlineState.set(true);
    const onOffline = (): void => this.isOnlineState.set(false);
    const onBeforeInstallPrompt = (event: Event): void => {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      this.deferredPrompt.set(event);
    };
    const onAppInstalled = (): void => {
      this.deferredPrompt.set(null);
      this.isStandaloneState.set(true);
    };
    const onDisplayModeChange = (event: MediaQueryListEvent): void => {
      this.isStandaloneState.set(event.matches);
    };

    win.addEventListener('online', onOnline);
    win.addEventListener('offline', onOffline);
    win.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    win.addEventListener('appinstalled', onAppInstalled);
    standaloneMedia?.addEventListener('change', onDisplayModeChange);

    this.destroyRef.onDestroy(() => {
      win.removeEventListener('online', onOnline);
      win.removeEventListener('offline', onOffline);
      win.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      win.removeEventListener('appinstalled', onAppInstalled);
      standaloneMedia?.removeEventListener('change', onDisplayModeChange);
    });

    if ('serviceWorker' in navigator) {
      this.registerServiceWorker(win);
    }
  }

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const promptEvent = this.deferredPrompt();
    if (!promptEvent) return 'unavailable';
    this.deferredPrompt.set(null);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      return outcome;
    } catch {
      return 'dismissed';
    }
  }

  applyUpdate(): void {
    if (!this.waitingWorker) return;
    this.reloadingForUpdate = true;
    this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  private registerServiceWorker(win: Window): void {
    const onControllerChange = (): void => {
      if (!this.reloadingForUpdate) return;
      this.reloadingForUpdate = false;
      win.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    this.destroyRef.onDestroy(() =>
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange),
    );

    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting) {
          this.notifyUpdate(registration.waiting);
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              this.notifyUpdate(installing);
            }
          });
        });
      })
      .catch(() => undefined);
  }

  private notifyUpdate(worker: ServiceWorker): void {
    this.waitingWorker = worker;
    this.updateAvailableState.set(true);
    const ref = this.snackBar.open('A new version of Jtalk is ready.', 'Reload', {
      duration: 0,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
    const sub = ref.onAction().subscribe(() => this.applyUpdate());
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
