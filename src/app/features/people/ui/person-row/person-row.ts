import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { PractisingPerson } from '../../models/person.model';

@Component({
  selector: 'app-person-row',
  imports: [MatButtonModule, MatIconModule, MatListModule, MatMenuModule],
  host: {
    class: 'person',
  },
  templateUrl: './person-row.html',
  styleUrl: './person-row.scss',
})
export class PersonRow {
  readonly person = input.required<PractisingPerson>();
  readonly busy = input(false);
  readonly followToggle = output<PractisingPerson>();
  readonly blockUser = output<PractisingPerson>();
}
