import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { PartnerMatchComponent } from './partner-match.component';

describe('PartnerMatchComponent (presentational)', () => {
  let fixture: ComponentFixture<PartnerMatchComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const title = () => root().querySelector('strong')?.textContent;
  const text = () => root().querySelector('p')?.textContent;

  async function render(match: unknown) {
    fixture = TestBed.createComponent(PartnerMatchComponent);
    fixture.componentRef.setInput('match', match);
    await fixture.whenStable();
  }

  it('celebrates a two-way exchange, naming both languages', async () => {
    await render({ kind: 'exchange', theySpeak: 'es', theyLearn: 'ar' });

    expect(title()).toBe('Language exchange match');
    expect(text()).toBe(
      'Speaks Spanish, which you are learning, and is learning Arabic, which you speak.',
    );
    expect(root().querySelector('.match')?.classList).toContain('exchange');
  });

  it('says how they can help, one way', async () => {
    await render({ kind: 'teaches-you', theySpeak: 'es' });
    expect(title()).toBe('Can help you practise');
    expect(text()).toBe('Speaks Spanish, which you are learning.');
    expect(root().querySelector('.match')?.classList).not.toContain('exchange');

    await render({ kind: 'learns-yours', theyLearn: 'ar' });
    expect(title()).toBe('You can help them practise');
    expect(text()).toBe('Is learning Arabic, which you speak.');
  });

  it('says nothing when there is no match, or none is known yet', async () => {
    await render({ kind: 'none' });
    expect(root().querySelector('.match')).toBeNull();

    await render(undefined);
    expect(root().querySelector('.match')).toBeNull();
  });
});
