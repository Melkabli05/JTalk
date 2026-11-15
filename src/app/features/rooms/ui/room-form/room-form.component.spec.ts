import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { formHarness } from '@shared/utils/form-harness';
import type { Room, RoomDraft, RoomEdit } from '../../models/room.model';
import { RoomFormComponent } from './room-form.component';

const DEFAULTS: RoomDraft = {
  title: 'Practice room',
  topic: 'Just chatting',
  targetLanguage: 'ar',
  nativeLanguage: 'en',
  maxStageSeats: 4,
};

const ROOM: Room = {
  id: 'r-1',
  title: 'Spanish',
  topic: 'Food',
  hostId: 'h-1',
  targetLanguage: 'es',
  nativeLanguage: 'en',
  maxStageSeats: 8,
  speakers: ['h-1'],
  participantCount: 1,
  handRaiseCount: 0,
};

describe('RoomFormComponent (presentational)', () => {
  let fixture: ComponentFixture<RoomFormComponent>;
  let saved: Mock<(draft: RoomDraft) => void>;
  let edited: Mock<(edit: RoomEdit) => void>;
  const { root, field, type, submit } = formHarness(() => fixture);

  async function render(inputs: Partial<Record<'room' | 'defaults' | 'submitting', unknown>> = {}) {
    fixture = TestBed.createComponent(RoomFormComponent);
    saved = vi.fn<(draft: RoomDraft) => void>();
    edited = vi.fn<(edit: RoomEdit) => void>();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.edited.subscribe(edited);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('starts from the defaults it is given: text, languages and seats', async () => {
    await render({ defaults: DEFAULTS });

    expect(field('Title').value).toBe('Practice room');
    expect(field('Topic').value).toBe('Just chatting');
    const selects = [...root().querySelectorAll('app-select-field')].map((s) => s.textContent);
    expect(selects[0]).toContain('Arabic');
    expect(selects[1]).toContain('English');
    expect(selects[2]).toContain('4');
  });

  it('opens a room with the defaults when submitted as it is', async () => {
    await render({ defaults: DEFAULTS });
    await submit();

    expect(saved).toHaveBeenCalledExactlyOnceWith(DEFAULTS);
  });

  it('starts empty, with sensible languages and seats, when there are no defaults', async () => {
    await render();

    expect(field('Title').value).toBe('');
    await type('Title', 'Hola');
    await submit();
    expect(saved).toHaveBeenCalledExactlyOnceWith({
      title: 'Hola',
      topic: '',
      targetLanguage: 'es',
      nativeLanguage: 'en',
      maxStageSeats: 6,
    });
  });

  it('trims what the person types', async () => {
    await render({ defaults: DEFAULTS });
    await type('Title', '   Café   ');
    await type('Topic', '  menus  ');
    await submit();

    expect(saved).toHaveBeenCalledExactlyOnceWith({ ...DEFAULTS, title: 'Café', topic: 'menus' });
  });

  it('refuses an empty title, shows why, and focuses it', async () => {
    await render({ defaults: DEFAULTS });
    await type('Title', '');
    await submit();

    expect(root().textContent).toContain('Give the room a title.');
    expect(document.activeElement).toBe(field('Title'));
    expect(saved).not.toHaveBeenCalled();
  });

  it('refuses a title that is too long', async () => {
    await render({ defaults: DEFAULTS });
    await type('Title', 'x'.repeat(81));
    await submit();

    expect(root().textContent).toContain('Use at most 80 characters.');
    expect(saved).not.toHaveBeenCalled();
  });

  it('edits an open room: no language fields, and it emits an edit, not a new room', async () => {
    await render({ room: ROOM });

    expect(field('Title').value).toBe('Spanish');
    expect(root().querySelectorAll('app-select-field')).toHaveLength(1);
    await type('Title', 'Spanish II');
    await submit();

    expect(edited).toHaveBeenCalledExactlyOnceWith({
      title: 'Spanish II',
      topic: 'Food',
      maxStageSeats: 8,
    });
    expect(saved).not.toHaveBeenCalled();
  });

  it('ignores a submit while the container is still saving', async () => {
    await render({ defaults: DEFAULTS, submitting: true });
    await submit();

    expect(saved).not.toHaveBeenCalled();
  });

  it('can be cancelled', async () => {
    await render({ defaults: DEFAULTS });
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    [...root().querySelectorAll('button')].find((b) => b.textContent?.includes('Cancel'))!.click();

    expect(cancelled).toHaveBeenCalledOnce();
  });
});
