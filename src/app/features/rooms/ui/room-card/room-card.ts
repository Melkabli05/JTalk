import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LiveRoomCard } from '../../models/room-card.model';

@Component({
  selector: 'app-room-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './room-card.html',
  styleUrl: './room-card.scss',
})
export class RoomCard {
  readonly room = input.required<LiveRoomCard>();
  readonly join = output<LiveRoomCard>();
  readonly pin = output<LiveRoomCard>();
  readonly notInterested = output<LiveRoomCard>();
}
