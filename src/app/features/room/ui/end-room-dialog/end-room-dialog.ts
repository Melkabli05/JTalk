import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-end-room-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './end-room-dialog.html',
  styleUrl: './end-room-dialog.scss',
})
export class EndRoomDialog {}
