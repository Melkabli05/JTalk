import { TestBed } from '@angular/core/testing';
import { ActiveRoomService } from './active-room.service';

describe('ActiveRoomService', () => {
  it('says which room the person is in, and nothing once they are in none', () => {
    const active = TestBed.inject(ActiveRoomService);
    expect(active.room()).toBeNull();

    active.set({ id: 'r-1', title: 'Spanish coffee' });
    expect(active.room()).toEqual({ id: 'r-1', title: 'Spanish coffee' });

    active.set(null);
    expect(active.room()).toBeNull();
  });

  it('leaves the room the way the rooms feature said to, and does nothing before it did', () => {
    const active = TestBed.inject(ActiveRoomService);
    expect(() => active.leave()).not.toThrow();

    const leave = vi.fn();
    active.onLeave(leave);
    active.leave();

    expect(leave).toHaveBeenCalledOnce();
  });

  describe('across a reload', () => {
    beforeEach(() => sessionStorage.clear());

    it('writes the room to this tab, so a reload can go back to it, and takes it away once the room is left', () => {
      const active = TestBed.inject(ActiveRoomService);

      active.set({ id: 'r-1', title: 'Spanish coffee' });
      expect(sessionStorage.getItem('jtalk:room')).toBe('r-1');

      active.set(null);
      expect(sessionStorage.getItem('jtalk:room')).toBeNull();
    });

    it('knows which room the tab was in before it was reloaded, and none when it was in none', () => {
      expect(TestBed.inject(ActiveRoomService).remembered).toBeNull();

      TestBed.resetTestingModule();
      sessionStorage.setItem('jtalk:room', 'r-9');

      expect(TestBed.inject(ActiveRoomService).remembered).toBe('r-9');
    });
  });
});
