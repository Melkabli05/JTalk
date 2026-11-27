import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import type { ProfileLanguageEditorData } from '../../models/profile.model';
import { LanguageEditorDialog } from './language-editor-dialog';

describe('LanguageEditorDialog', () => {
  function createDialog(data: ProfileLanguageEditorData) {
    const closeSpy = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LanguageEditorDialog],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: closeSpy } },
      ],
    });
    const fixture = TestBed.createComponent(LanguageEditorDialog);
    fixture.detectChanges();
    return { fixture, closeSpy };
  }

  it('returns null level when role is NATIVE and returns chosen proficiency when role is LEARNING', () => {
    const { fixture, closeSpy } = createDialog({
      mode: 'add',
      existingCodes: ['ar'],
      primaryNativeCode: 'ar',
      allowNativeRole: true,
    });

    const comp = fixture.componentInstance;
    comp.onOptionSelected('ja');
    comp.onRoleChange('NATIVE');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('mat-select')).toBeNull();
    comp.submit();
    expect(closeSpy).toHaveBeenCalledWith({ code: 'ja', role: 'NATIVE', level: null });

    closeSpy.mockReset();
    comp.onRoleChange('LEARNING');
    comp.onLevelChange('ADVANCED');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('mat-select')).toBeTruthy();
    comp.submit();
    expect(closeSpy).toHaveBeenCalledWith({ code: 'ja', role: 'LEARNING', level: 'ADVANCED' });
  });

  it('prevents switching the primary native language to LEARNING', () => {
    const { fixture, closeSpy } = createDialog({
      mode: 'edit',
      existingCodes: ['ar', 'en'],
      primaryNativeCode: 'ar',
      initialCode: 'ar',
      initialRole: 'NATIVE',
      allowNativeRole: true,
    });

    const comp = fixture.componentInstance;
    comp.onRoleChange('LEARNING');
    fixture.detectChanges();

    expect(comp.isPrimaryNative()).toBe(true);
    expect(comp.canSubmit()).toBe(false);
    comp.submit();
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
