import { Injector } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { ActiveRoomService } from '@core/rooms/active-room.service';
import { RoomFacade } from './features/rooms/state/room.facade';

/**
 * Takes the person back to the room they were in when the page was reloaded (or opened again with a full page load, as a typed address
 * does). The room is remembered per tab, so closing the tab is how a person really leaves; a reload only interrupts. It waits for Auth0
 * to say whether anyone is signed in, and forgets the room if no one is. The room's own page needs no help (it joins by its address); the
 * header badge and the audio come back wherever the person was.
 */
export async function restoreRoom(injector: Injector, id: string): Promise<void> {
  const signedIn = await firstValueFrom(injector.get(AuthService).isAuthenticated$);
  if (!signedIn) {
    injector.get(ActiveRoomService).set(null);
    return;
  }
  injector.get(RoomFacade).enter(id);
}
