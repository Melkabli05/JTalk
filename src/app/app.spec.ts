import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { App } from './app';

describe('App', () => {
  it('renders a router outlet', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), MessageService] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('p-toast')).not.toBeNull();
  });
});
