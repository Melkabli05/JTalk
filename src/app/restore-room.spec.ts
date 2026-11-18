import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { of } from 'rxjs';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { RoomFacade } from './features/rooms/state/room.facade';
import { restoreRoom } from './restore-room';

describe('restoreRoom', () => {
  const enter = vi.fn();

  function setup(signedIn: boolean) {
    enter.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('jtalk:room', 'r-1');
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated$: of(signedIn) } },
        { provide: RoomFacade, useValue: { enter } },
      ],
    });
    return TestBed.inject(Injector);
  }

  it('joins the room again for someone who is signed in', async () => {
    const injector = setup(true);

    await restoreRoom(injector, 'r-1');

    expect(enter).toHaveBeenCalledExactlyOnceWith('r-1');
  });

  it('forgets the room, and joins nothing, when no one is signed in', async () => {
    const injector = setup(false);
    expect(injector.get(ActiveRoomService).remembered).toBe('r-1');

    await restoreRoom(injector, 'r-1');

    expect(enter).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('jtalk:room')).toBeNull();
  });
});
