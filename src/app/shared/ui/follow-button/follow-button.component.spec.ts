import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { FollowButtonComponent } from './follow-button.component';

describe('FollowButtonComponent (presentational)', () => {
  let fixture: ComponentFixture<FollowButtonComponent>;
  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button')!;

  async function render(inputs: Record<string, unknown>) {
    fixture = TestBed.createComponent(FollowButtonComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  it('offers to follow, and asks to follow back when they already follow me', async () => {
    const followed = vi.fn();
    await render({});
    fixture.componentInstance.follow.subscribe(followed);
    expect(button().textContent?.trim()).toBe('Follow');

    button().click();
    expect(followed).toHaveBeenCalledOnce();

    fixture.componentRef.setInput('followsMe', true);
    await fixture.whenStable();
    expect(button().textContent?.trim()).toBe('Follow back');
  });

  it('says Following, and unfollows with the same press', async () => {
    const unfollowed = vi.fn();
    await render({ following: true });
    fixture.componentInstance.unfollow.subscribe(unfollowed);

    expect(button().textContent?.trim()).toBe('Following');
    button().click();
    expect(unfollowed).toHaveBeenCalledOnce();
  });

  it('cannot be pressed while a request runs', async () => {
    await render({ busy: true });

    expect(button().disabled).toBe(true);
  });

  it('can be drawn compact, for a card, and stays regular elsewhere', async () => {
    await render({});
    expect(button().classList).not.toContain('compact');

    fixture.componentRef.setInput('compact', true);
    await fixture.whenStable();
    expect(button().classList).toContain('compact');

    fixture.componentRef.setInput('following', true);
    await fixture.whenStable();
    expect(button().classList).toContain('compact');
  });
});
