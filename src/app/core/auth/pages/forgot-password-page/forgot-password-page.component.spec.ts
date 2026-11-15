import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formHarness } from '@shared/utils/form-harness';
import ForgotPasswordPageComponent from './forgot-password-page.component';

describe('ForgotPasswordPageComponent (container)', () => {
  let fixture: ComponentFixture<ForgotPasswordPageComponent>;
  let http: HttpTestingController;
  const { root, type, submit } = formHarness(() => fixture);

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ForgotPasswordPageComponent);
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  it('asks for a link and gives the same answer whether or not the address has an account', async () => {
    await type('Email', 'ghost@x.io');
    await submit();
    const request = http.expectOne('/api/auth/forgot-password');
    expect(request.request.body).toEqual({ email: 'ghost@x.io' });
    request.flush(null, { status: 202, statusText: 'Accepted' });
    await fixture.whenStable();

    expect(root().textContent).toContain('If that email address has an account');
  });

  it('shows a message and keeps the form when the request fails', async () => {
    await type('Email', 'ada@x.io');
    await submit();
    http.expectOne('/api/auth/forgot-password').flush({}, { status: 429, statusText: 'x' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Too many attempts');
    expect(root().querySelector('form')).not.toBeNull();
  });
});
