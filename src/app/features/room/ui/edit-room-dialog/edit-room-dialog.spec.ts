import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { vi } from 'vitest';
import { UpdateVoiceRoomPayload } from '../../../../shared/models/voice-room.model';
import { EditRoomDialog } from './edit-room-dialog';

describe('EditRoomDialog', () => {
  const close = vi.fn();

  beforeEach(() => {
    close.mockClear();
    TestBed.configureTestingModule({
      imports: [EditRoomDialog],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: {
          title: 'Practice room', topic: 'Just chatting', maxStageSeats: 6,
        } satisfies Required<UpdateVoiceRoomPayload> },
      ],
    });
  });

  it('submits trimmed details from the Material fields', async () => {
    const loader = TestbedHarnessEnvironment.loader(TestBed.createComponent(EditRoomDialog));
    await (await loader.getHarness(MatInputHarness.with({ selector: '#roomTitleInput' }))).setValue('  Café Español  ');
    await (await loader.getHarness(MatInputHarness.with({ selector: '#roomTopicInput' }))).setValue('  Food & Travel  ');
    await (await loader.getHarness(MatInputHarness.with({ selector: '#roomSeatsInput' }))).setValue('10');
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Save' }))).click();

    expect(close).toHaveBeenCalledWith({ title: 'Café Español', topic: 'Food & Travel', maxStageSeats: 10 });
  });

  it('sends only the changed topic when the host clears it', async () => {
    const loader = TestbedHarnessEnvironment.loader(TestBed.createComponent(EditRoomDialog));
    await (await loader.getHarness(MatInputHarness.with({ selector: '#roomTopicInput' }))).setValue('');
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Save' }))).click();
    expect(close).toHaveBeenCalledWith({ topic: '' });
  });

  it('shows validation feedback and blocks empty or fractional seat counts', async () => {
    const loader = TestbedHarnessEnvironment.loader(TestBed.createComponent(EditRoomDialog));
    const seats = await loader.getHarness(MatInputHarness.with({ selector: '#roomSeatsInput' }));
    const save = await loader.getHarness(MatButtonHarness.with({ text: 'Save' }));
    const field = await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: 'Stage seats including the host' }));

    await seats.focus();
    await seats.setValue('2.5');
    await seats.blur();
    expect(await save.isDisabled()).toBe(true);
    expect(await field.getTextErrors()).toContain('Enter a whole number of seats.');

    await seats.setValue('');
    expect(await save.isDisabled()).toBe(true);
    expect(await field.getTextErrors()).toContain('Enter the number of stage seats.');
    expect(close).not.toHaveBeenCalled();
  });
});
