import { Component } from '@angular/core';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

/** The empty starting point: replace it with the first real page (the room hallway). */
@Component({
  selector: 'app-home-page',
  imports: [TranslatePipe],
  template: `
    <h1>{{ 'Live communication' | t }}</h1>
    <p>{{ 'Voice rooms for language practice will live here.' | t }}</p>
  `,
})
export default class HomePageComponent {}
