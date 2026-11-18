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
});
