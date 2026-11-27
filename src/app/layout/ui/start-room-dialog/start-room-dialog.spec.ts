import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { vi } from 'vitest';
import { StartRoomDialog, type StartRoomDialogData } from './start-room-dialog';

describe('StartRoomDialog', () => {
  const closeSpy = vi.fn();

  beforeEach(() => {
    closeSpy.mockReset();
    TestBed.configureTestingModule({
      imports: [StartRoomDialog],
      providers: [{ provide: MatDialogRef, useValue: { close: closeSpy } }],
    });
  });

  it('submits trimmed room settings from the Material controls', async () => {
    const loader = TestbedHarnessEnvironment.loader(TestBed.createComponent(StartRoomDialog));
    await (
      await loader.getHarness(MatInputHarness.with({ selector: '#srTitleInput' }))
    ).setValue('  Evening Spanish  ');
    await (
      await loader.getHarness(MatInputHarness.with({ selector: '#srTopicInput' }))
    ).setValue('  Travel stories  ');
    const seats = await loader.getHarness(
      MatSelectHarness.with({ selector: '[aria-label="Stage seats, including you"]' }),
    );
    await seats.clickOptions({ text: '4' });
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Open the room' }))).click();

    expect(closeSpy).toHaveBeenCalledWith({
      title: 'Evening Spanish',
      topic: 'Travel stories',
      targetLanguage: 'es',
      nativeLanguage: 'en',
      maxStageSeats: 4,
    });
  });

  it('shows which text field exceeds the limit and blocks submission', async () => {
    const loader = TestbedHarnessEnvironment.loader(TestBed.createComponent(StartRoomDialog));
    const title = await loader.getHarness(MatInputHarness.with({ selector: '#srTitleInput' }));
    const topic = await loader.getHarness(MatInputHarness.with({ selector: '#srTopicInput' }));
    const open = await loader.getHarness(MatButtonHarness.with({ text: 'Open the room' }));

    await title.focus();
    await title.setValue('x'.repeat(81));
    await title.blur();
    expect(await open.isDisabled()).toBe(true);
    expect(
      await (
        await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: 'Title' }))
      ).getTextErrors(),
    ).toContain('Use 80 characters or fewer.');

    await title.setValue('Practice');
    await topic.focus();
    await topic.setValue('x'.repeat(256));
    await topic.blur();
    expect(await open.isDisabled()).toBe(true);
    expect(
      await (
        await loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: 'Topic' }))
      ).getTextErrors(),
    ).toContain('Use 255 characters or fewer.');
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('defaults to 8 stage seats and preserves input with an inline error when submit fails', async () => {
    const submit = vi.fn().mockResolvedValueOnce('Unable to reach JTalk right now.');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StartRoomDialog],
      providers: [
        { provide: MatDialogRef, useValue: { close: closeSpy } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            defaults: { targetLanguage: 'ja', nativeLanguage: 'fr' },
            submit,
          } satisfies StartRoomDialogData,
        },
      ],
    });

    const fixture = TestBed.createComponent(StartRoomDialog);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const title = await loader.getHarness(MatInputHarness.with({ selector: '#srTitleInput' }));
    await title.setValue('Tokyo Tea Chat');
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Open the room' }))).click();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledWith({
      title: 'Tokyo Tea Chat',
      topic: 'Just chatting',
      targetLanguage: 'ja',
      nativeLanguage: 'fr',
      maxStageSeats: 8,
    });
    expect(closeSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to reach JTalk right now.',
    );
    expect(await title.getValue()).toBe('Tokyo Tea Chat');
  });
});
