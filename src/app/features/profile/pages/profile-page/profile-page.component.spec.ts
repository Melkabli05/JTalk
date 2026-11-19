import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { of } from 'rxjs';
import { fakeAuth0 } from '@core/auth/auth-testing';
import ProfilePageComponent from './profile-page.component';

const profile = {
  id: 'm-1',
  username: 'mona_1a2b3c',
  displayName: 'Mona',
  avatarUrl: '/avatars/avatar-06.svg',
  nativeLanguage: 'ar',
  createdAt: '2026-11-18T10:00:00Z',
  nativeLanguages: ['ar'],
  learningLanguages: [{ languageCode: 'en', proficiencyLevel: 'BEGINNER' }],
};

describe('ProfilePageComponent (container)', () => {
  let fixture: ComponentFixture<ProfilePageComponent>;
  let http: HttpTestingController;
  const toast = { add: vi.fn() };
  const logout = vi.fn(() => of(undefined));
  const root = () => fixture.nativeElement as HTMLElement;

  async function settle() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    toast.add.mockClear();
    logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeAuth0({ logout }),
        { provide: MessageService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfilePageComponent);
    await settle();
  });

  async function load() {
    http.expectOne('/api/v1/users/me').flush(profile);
    await settle();
  }

  async function submit() {
    root()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  it('shows a spinner until the profile has arrived, then the person and a form to change it', async () => {
    expect(root().querySelector('p-progress-spinner')).not.toBeNull();

    await load();

    expect(root().querySelector('p-progress-spinner')).toBeNull();
    expect(root().querySelector('app-profile-hero h1')?.textContent).toBe('Mona');
    expect(root().querySelector<HTMLInputElement>('app-profile-form input')?.value).toBe('Mona');
  });

  it('saves a change, shows the new profile and says so', async () => {
    await load();
    const name = root().querySelector<HTMLInputElement>('app-profile-form input')!;
    name.value = 'Mona H';
    name.dispatchEvent(new Event('input'));
    await submit();

    const patch = http.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/users/me');
    expect(patch.request.body).toMatchObject({ displayName: 'Mona H', nativeLanguage: 'ar' });
    expect(patch.request.body).not.toHaveProperty('learningLanguages');
    patch.flush({ ...profile, displayName: 'Mona H' });
    await settle();
    http
      .match('/api/v1/users/m-1')
      .forEach((request) => request.flush({ ...profile, displayName: 'Mona H' }));
    http.match('/api/v1/users/m-1/social').forEach((request) =>
      request.flush({
        followerCount: 0,
        followingCount: 0,
        followedByMe: false,
        followsMe: false,
      }),
    );
    await settle();

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Profile saved.' }),
    );
    expect(root().querySelector('app-profile-hero h1')?.textContent).toBe('Mona H');
  });

  it('says so above the form when the profile could not be saved, and lets the person try again', async () => {
    await load();
    await submit();
    http
      .expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/users/me')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root().querySelector('p-message[role="alert"]')?.textContent).toContain(
      'Could not save your profile. Please try again.',
    );
    expect(toast.add).not.toHaveBeenCalled();
    await submit();
    http.expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/users/me');
  });

  it('shows your own numbers, what is in your bio, and your languages with their levels', async () => {
    await load();
    http.expectOne('/api/v1/users/m-1').flush({ ...profile, bio: '', countryCode: 'MA' });
    http
      .expectOne('/api/v1/users/m-1/social')
      .flush({ followerCount: 12, followingCount: 3, followedByMe: false, followsMe: false });
    await settle();

    expect(root().textContent).toContain('@mona_1a2b3c');
    expect(root().textContent).toContain('Morocco');
    expect(root().textContent).toContain('Followers');
    expect(root().textContent).toContain('12');
    expect(root().textContent).toContain('Add a short bio');
    expect(root().textContent).toContain('Beginner');
    expect(root().textContent).not.toContain('Follow back');
  });

  describe('deleting the account', () => {
    const page = () => document.body;

    async function openDialog() {
      await load();
      http.match('/api/v1/users/m-1').forEach((r) => r.flush(profile));
      http
        .match('/api/v1/users/m-1/social')
        .forEach((r) =>
          r.flush({ followerCount: 0, followingCount: 0, followedByMe: false, followsMe: false }),
        );
      http
        .match('/api/v1/users/m-1/languages')
        .forEach((r) => r.flush({ userId: 'm-1', nativeLanguages: ['ar'], learningLanguages: [] }));
      await settle();
      root().querySelector<HTMLButtonElement>('.danger button')!.click();
      await settle();
    }

    const type = async (text: string) => {
      const field = page().querySelector<HTMLInputElement>('.p-dialog input')!;
      field.value = text;
      field.dispatchEvent(new Event('input'));
      await settle();
    };

    it('has its own card at the bottom, in the danger colour, and asks before anything is deleted', async () => {
      await load();

      const card = root().querySelector('.danger')!;
      expect(card.querySelector('h2')?.textContent).toBe('Delete your account');
      expect(card.querySelector('button')?.className).toContain('p-button-danger');
      expect(card.querySelector('button')?.className).toContain('p-button-outlined');
      expect(page().querySelector('.p-dialog')).toBeNull();
      http.expectNone((r) => r.method === 'DELETE');
    });

    it('deletes only once the handle has been typed, and then signs out', async () => {
      await openDialog();
      expect(page().querySelector('.p-dialog')).not.toBeNull();

      await type('someone else');
      expect(
        [...page().querySelectorAll<HTMLButtonElement>('.p-dialog button')].find((b) =>
          b.textContent?.includes('Delete my account'),
        )?.disabled,
      ).toBe(true);

      await type(profile.username);
      [...page().querySelectorAll<HTMLButtonElement>('.p-dialog button')]
        .find((b) => b.textContent?.includes('Delete my account'))!
        .click();
      await settle();

      http
        .expectOne((r) => r.method === 'DELETE' && r.url === '/api/v1/users/me')
        .flush(null, {
          status: 204,
          statusText: 'No Content',
        });
      await settle();
      expect(logout).toHaveBeenCalledOnce();
    });

    it('says so, and stays signed in, when the account could not be deleted', async () => {
      await openDialog();
      await type(profile.username);
      [...page().querySelectorAll<HTMLButtonElement>('.p-dialog button')]
        .find((b) => b.textContent?.includes('Delete my account'))!
        .click();
      await settle();

      http
        .expectOne((r) => r.method === 'DELETE' && r.url === '/api/v1/users/me')
        .flush({}, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(page().querySelector('.p-dialog p-message')?.textContent).toContain(
        'Could not delete your account. Please try again.',
      );
      expect(logout).not.toHaveBeenCalled();
    });
  });
});
