import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
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
  const root = () => fixture.nativeElement as HTMLElement;

  async function settle() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('jtalk:locale', 'en');
    toast.add.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        fakeAuth0(),
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
});
