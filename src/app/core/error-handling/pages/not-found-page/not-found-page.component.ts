import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';

@Component({
  selector: 'app-not-found-page',
  imports: [ButtonDirective, RouterLink],
  template: `
    <h1>Page not found</h1>
    <p>The page you are looking for does not exist.</p>
    <a pButton routerLink="/" [outlined]="true">Back to home</a>
  `,
})
export default class NotFoundPageComponent {}
