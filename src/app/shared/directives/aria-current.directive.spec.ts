import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AriaCurrentDirective } from './aria-current.directive';

@Component({ selector: 'app-stub', template: '' })
class StubComponent {}

@Component({
  imports: [AriaCurrentDirective],
  template: `
    <nav appAriaCurrent>
      <a href="/users">Users</a>
      <a href="/orders">Orders</a>
      <span>not a link</span>
    </nav>
  `,
})
class HostComponent {}

describe('AriaCurrentDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'users', children: [{ path: '**', component: StubComponent }] },
          { path: 'orders', component: StubComponent },
        ]),
      ],
    });
  });

  async function setup(url: string) {
    const fixture = TestBed.createComponent(HostComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')];
    return {
      fixture,
      current: () => links.filter((a) => a.getAttribute('aria-current') === 'page'),
    };
  }

  it('marks the link for the current page', async () => {
    const { current } = await setup('/orders');
    expect(current().map((a) => a.textContent)).toEqual(['Orders']);
  });

  it('keeps a section marked while on a page below it, and ignores the query string', async () => {
    const { current } = await setup('/users/5?tab=1');
    expect(current().map((a) => a.textContent)).toEqual(['Users']);
  });

  it('moves the mark when the user navigates', async () => {
    const { fixture, current } = await setup('/users');
    await TestBed.inject(Router).navigateByUrl('/orders');
    await fixture.whenStable();

    expect(current().map((a) => a.textContent)).toEqual(['Orders']);
  });

  it('marks nothing on a page that belongs to no link', async () => {
    TestBed.inject(Router).resetConfig([{ path: '**', component: StubComponent }]);
    const { current } = await setup('/elsewhere');
    expect(current()).toEqual([]);
  });
});
