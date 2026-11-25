import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-inroom-banner',
  imports: [MatButtonModule],
  templateUrl: './inroom-banner.html',
  styleUrl: './inroom-banner.scss',
})
export class InRoomBanner {
  readonly visible = input.required<boolean>();
  readonly roomTitle = input.required<string>();
  readonly backToRoom = output<void>();
}
