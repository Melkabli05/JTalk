import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmationService } from '@openng/optimus-ui/api';
import { I18n } from './i18n/i18n.service';
import { confirmDiscard, unsavedChangesGuard } from './unsaved-changes';

describe('unsaved changes', () => {
  it('guard asks the page whether it can be left', () => {
    const page = { canLeave: vi.fn().mockReturnValue(false) };
    const run = () =>
      TestBed.runInInjectionContext(() =>
        unsavedChangesGuard(
          page,
          {} as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
          {} as RouterStateSnapshot,
        ),
      );

    expect(run()).toBe(false);
    expect(page.canLeave).toHaveBeenCalledOnce();
  });

  describe('confirmDiscard', () => {
    const ask = () => {
      const confirmation = new ConfirmationService();
      const confirm = vi.spyOn(confirmation, 'confirm');
      const answer = confirmDiscard(confirmation, TestBed.inject(I18n));
      return { answer, options: confirm.mock.calls[0][0] };
    };

    it("asks in the reader's language", async () => {
      const i18n = TestBed.inject(I18n);
      await i18n.use('ar');
      const confirmation = new ConfirmationService();
      const confirm = vi.spyOn(confirmation, 'confirm');

      void confirmDiscard(confirmation, i18n);

      expect(confirm.mock.calls[0][0].header).toBe('تجاهل التغييرات؟');
      expect(confirm.mock.calls[0][0].rejectLabel).toBe('متابعة التعديل');
      await i18n.use('en');
    });

    it('resolves true when the user discards', async () => {
      const { answer, options } = ask();
      options.accept?.();
      await expect(answer).resolves.toBe(true);
    });

    it('resolves false on any other way out (keep editing, close, Escape)', async () => {
      const { answer, options } = ask();
      options.reject?.();
      await expect(answer).resolves.toBe(false);
    });
  });
});
