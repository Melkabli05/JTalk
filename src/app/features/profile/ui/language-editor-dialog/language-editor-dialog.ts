import { Component, computed, inject, signal } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { LanguageType, ProficiencyLevel } from '../../../../core/auth/auth.models';
import { LANGUAGE_CATALOG } from '../../../../core/utils/language-codes';
import { PROFICIENCY_LEVELS } from '../../constants/profile.constants';
import type {
  ProfileLanguageEditorData,
  ProfileLanguageEditorResult,
} from '../../models/profile.model';
import {
  displayLanguageName,
  formatProficiencyLevel,
  languageBaseCode,
  languageFlagCodeFor,
  nativeLanguageName,
} from '../../utils/profile-format.utils';
import { LevelMeter } from '../level-meter/level-meter';

interface LanguageOption {
  readonly code: string;
  readonly displayName: string;
  readonly nativeName: string | null;
  readonly flagCountryCode: string | null;
  readonly searchText: string;
}

const ALL_LANGUAGE_OPTIONS: readonly LanguageOption[] = LANGUAGE_CATALOG.map((entry) => {
  const displayName = displayLanguageName(entry.code) || entry.name;
  const nativeName = nativeLanguageName(entry.code, displayName);
  return {
    code: entry.code,
    displayName,
    nativeName,
    flagCountryCode: entry.flagCountryCode,
    searchText: `${displayName} ${nativeName ?? ''} ${entry.code}`.toLowerCase(),
  };
}).sort((a, b) => a.displayName.localeCompare(b.displayName));

@Component({
  selector: 'app-language-editor-dialog',
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    LevelMeter,
  ],
  templateUrl: './language-editor-dialog.html',
  styleUrl: './language-editor-dialog.scss',
})
export class LanguageEditorDialog {
  private readonly dialogRef = inject(
    MatDialogRef<LanguageEditorDialog, ProfileLanguageEditorResult | undefined>,
    { optional: true },
  );
  private readonly sheetRef = inject(
    MatBottomSheetRef<LanguageEditorDialog, ProfileLanguageEditorResult | undefined>,
    { optional: true },
  );
  private readonly dialogData = inject<ProfileLanguageEditorData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly sheetData = inject<ProfileLanguageEditorData | null>(MAT_BOTTOM_SHEET_DATA, {
    optional: true,
  });

  readonly data: ProfileLanguageEditorData = this.dialogData ??
    this.sheetData ?? {
      mode: 'add',
      existingCodes: [],
      primaryNativeCode: 'en',
      allowNativeRole: true,
    };

  readonly isEdit = this.data.mode === 'edit';
  readonly allowNativeRole = this.data.allowNativeRole ?? true;
  readonly levels = PROFICIENCY_LEVELS;
  readonly formatLevel = formatProficiencyLevel;

  readonly selectedCode = signal<string>(this.data.initialCode ?? '');
  readonly query = signal<string>(
    this.data.initialCode ? displayLanguageName(this.data.initialCode) : '',
  );
  readonly role = signal<LanguageType>(
    this.data.initialRole ?? (this.allowNativeRole ? 'LEARNING' : 'LEARNING'),
  );
  readonly level = signal<ProficiencyLevel>(this.data.initialLevel ?? 'BEGINNER');

  private readonly existingSet = new Set(
    this.data.existingCodes.map((code) => languageBaseCode(code)),
  );

  readonly filteredOptions = computed<readonly LanguageOption[]>(() => {
    const q = this.query().trim().toLowerCase();
    return ALL_LANGUAGE_OPTIONS.filter((opt) => {
      if (!this.isEdit && this.existingSet.has(opt.code.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return opt.searchText.includes(q);
    }).slice(0, 40);
  });

  readonly selectedDisplayName = computed(() =>
    this.selectedCode() ? displayLanguageName(this.selectedCode()) : '',
  );
  readonly selectedNativeName = computed(() =>
    this.selectedCode()
      ? nativeLanguageName(this.selectedCode(), this.selectedDisplayName())
      : null,
  );
  readonly selectedFlagCode = computed(() => languageFlagCodeFor(this.selectedCode()));

  readonly isPrimaryNative = computed(
    () =>
      Boolean(this.selectedCode()) &&
      languageBaseCode(this.selectedCode()) === languageBaseCode(this.data.primaryNativeCode),
  );

  readonly canSubmit = computed(() => {
    const code = this.selectedCode().trim();
    if (!code) return false;
    if (this.role() === 'LEARNING' && this.isPrimaryNative()) return false;
    return true;
  });

  onQueryInput(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : '';
    this.query.set(value);
    const trimmed = value.trim().toLowerCase();
    const exact = ALL_LANGUAGE_OPTIONS.find(
      (opt) =>
        (opt.displayName.toLowerCase() === trimmed || opt.code.toLowerCase() === trimmed) &&
        (this.isEdit || !this.existingSet.has(opt.code.toLowerCase())),
    );
    this.selectedCode.set(exact ? exact.code : '');
  }

  onOptionSelected(code: string): void {
    this.selectedCode.set(code);
    this.query.set(displayLanguageName(code));
  }

  onRoleChange(next: LanguageType): void {
    this.role.set(next);
  }

  onLevelChange(next: ProficiencyLevel): void {
    this.level.set(next);
  }

  cancel(): void {
    this.close(undefined);
  }

  submit(event?: Event): void {
    event?.preventDefault();
    if (!this.canSubmit()) return;
    const role = this.role();
    this.close({
      code: this.selectedCode(),
      role,
      level: role === 'LEARNING' ? this.level() : null,
    });
  }

  private close(result: ProfileLanguageEditorResult | undefined): void {
    if (this.dialogRef) {
      this.dialogRef.close(result);
    } else if (this.sheetRef) {
      this.sheetRef.dismiss(result);
    }
  }
}
