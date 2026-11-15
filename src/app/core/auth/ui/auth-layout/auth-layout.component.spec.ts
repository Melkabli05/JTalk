import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  imports: [AuthLayoutComponent],
  template: `<app-auth-layout locale="en" heading="Sign in" [lead]="lead">
    <form>The form</form>
    <a href="/register">Create an account</a>
  </app-auth-layout>`,
})
class HostComponent {
  lead: string | undefined = 'Welcome back.';
}

describe('AuthLayoutComponent (presentational)', () => {
  async function render(lead?: string) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.lead = lead;
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('has one main landmark with the heading, the lead and the projected content', async () => {
    const root = await render('Welcome back.');
    const main = root.querySelectorAll('main');

    expect(main).toHaveLength(1);
    expect(main[0]?.querySelector('h1')?.textContent).toBe('Sign in');
    expect(main[0]?.querySelector('.lead')?.textContent).toBe('Welcome back.');
    expect(main[0]?.querySelector('form')).not.toBeNull();
    expect(main[0]?.querySelector('a[href="/register"]')).not.toBeNull();
  });

  it('leaves out the lead when there is none', async () => {
    expect((await render(undefined)).querySelector('.lead')).toBeNull();
  });

  it('hides the decorative poster from assistive technology', async () => {
    const poster = (await render()).querySelector('.poster');

    expect(poster?.getAttribute('aria-hidden')).toBe('true');
    expect(poster?.textContent).toContain('Jtalk');
  });
});
