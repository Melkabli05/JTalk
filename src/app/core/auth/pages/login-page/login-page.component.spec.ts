import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { formHarness } from '@shared/utils/form-harness';
import LoginPageComponent from './login-page.component';

describe('LoginPageComponent (container)', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const { root, type, submit } = formHarness(() => fixture);

  async function signIn() {
    await type('Email', 'ada@x.io');
    await type('Password', 'secret');
    await submit();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPageComponent);
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  it('signs in and goes home when there is no returnUrl', async () => {
    await signIn();
    http.expectOne('/api/auth/login').flush({ token: 'jwt' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('goes back to where the user was headed', async () => {
    fixture.componentRef.setInput('returnUrl', '/orders/3?tab=1');
    await signIn();
    http.expectOne('/api/auth/login').flush({ token: 'jwt' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/orders/3?tab=1', { replaceUrl: true });
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'users'])(
    'never redirects to %j (open redirect)',
    async (returnUrl) => {
      fixture.componentRef.setInput('returnUrl', returnUrl);
      await signIn();
      http.expectOne('/api/auth/login').flush({ token: 'jwt' });
      await fixture.whenStable();

      expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
    },
  );

  it('says the credentials were wrong on a 401 and stays put', async () => {
    await signIn();
    http
      .expectOne('/api/auth/login')
      .flush({ message: 'no' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Incorrect email or password.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('tells the person to slow down when the API rate limits', async () => {
    await signIn();
    http.expectOne('/api/auth/login').flush({}, { status: 429, statusText: 'Too Many Requests' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Too many attempts');
  });

  it('links to the other account pages', () => {
    expect(root().querySelector('a[href="/forgot-password"]')).not.toBeNull();
    expect(root().querySelector('a[href="/register"]')).not.toBeNull();
  });

  it('shows a generic error for any other failure', async () => {
    await signIn();
    http.expectOne('/api/auth/login').flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Could not sign in. Please try again.');
  });
});
