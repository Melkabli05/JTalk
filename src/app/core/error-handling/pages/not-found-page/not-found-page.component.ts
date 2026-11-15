import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

@Component({
  selector: 'app-not-found-page',
  imports: [TranslatePipe, ButtonDirective, RouterLink],
  template: `
    <h1>{{ 'Page not found' | t }}</h1>
    <p>{{ 'The page you are looking for does not exist.' | t }}</p>
    <a pButton routerLink="/" [outlined]="true">{{ 'Back to home' | t }}</a>
  `,
})
export default class NotFoundPageComponent {}
