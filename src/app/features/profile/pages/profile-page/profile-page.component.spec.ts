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
};
const matrix = {
  userId: 'm-1',
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
    http.expectOne('/api/v1/users/me/languages').flush(matrix);
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
    patch.flush({ ...profile, displayName: 'Mona H' });
    await settle();
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/v1/users/me')
      .flush({
        ...profile,
        displayName: 'Mona H',
      });
    http.expectOne('/api/v1/users/me/languages').flush(matrix);
    await settle();

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Profile saved.' }),
    );
    expect(root().querySelector('app-profile-hero h1')?.textContent).toBe('Mona H');
  });

  it('says so when the profile could not be saved', async () => {
    await load();
    await submit();
    http
      .expectOne((r) => r.method === 'PATCH' && r.url === '/api/v1/users/me')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Could not save your profile. Please try again.',
      }),
    );
  });
});
