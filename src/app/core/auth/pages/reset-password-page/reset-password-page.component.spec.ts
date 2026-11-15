import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formHarness } from '@shared/utils/form-harness';
import ResetPasswordPageComponent from './reset-password-page.component';

describe('ResetPasswordPageComponent (container)', () => {
  let fixture: ComponentFixture<ResetPasswordPageComponent>;
  let http: HttpTestingController;
  const { root, type, submit } = formHarness(() => fixture);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResetPasswordPageComponent);
  });
  afterEach(() => http.verify());

  async function choosePassword() {
    fixture.componentRef.setInput('token', 'abc123');
    await fixture.whenStable();
    await type('New password', 'correct horse battery');
    await submit();
  }

  it('explains a link without a token instead of showing a form', async () => {
    await fixture.whenStable();
    expect(root().textContent).toContain('This reset link is incomplete');
    expect(root().querySelector('form')).toBeNull();
  });

  it('sends the token with the new password, then points to sign in', async () => {
    await choosePassword();
    const request = http.expectOne('/api/auth/reset-password');
    expect(request.request.body).toEqual({ token: 'abc123', password: 'correct horse battery' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Your password was changed');
    expect(root().querySelector('a[href="/login"]')).not.toBeNull();
  });

  it.each([400, 410])('says the link is spent on a %i and offers a new one', async (status) => {
    await choosePassword();
    http.expectOne('/api/auth/reset-password').flush({}, { status, statusText: 'x' });
    await fixture.whenStable();

    expect(root().textContent).toContain('expired or was already used');
    expect(root().querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  it('shows a generic message for any other failure', async () => {
    await choosePassword();
    http.expectOne('/api/auth/reset-password').flush({}, { status: 500, statusText: 'x' });
    await fixture.whenStable();

    expect(root().textContent).toContain('Could not change your password');
  });
});
