import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formHarness } from '@shared/utils/form-harness';
import RegisterPageComponent from './register-page.component';

describe('RegisterPageComponent (container)', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let http: HttpTestingController;
  const { root, type, submit } = formHarness(() => fixture);

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegisterPageComponent);
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  async function fillAndSubmit() {
    await type('Email', 'ada@x.io');
    await type('Password', 'correct horse battery');
    await submit();
  }

  it('posts the credentials and shows a confirmation that reveals nothing about the address', async () => {
    await fillAndSubmit();
    const request = http.expectOne('/api/auth/register');
    expect(request.request.body).toEqual({ email: 'ada@x.io', password: 'correct horse battery' });
    request.flush(null, { status: 202, statusText: 'Accepted' });
    await fixture.whenStable();

    expect(root().textContent).toContain('If this address can be used');
    expect(root().querySelector('form')).toBeNull();
  });

  it('does not start a session (the person has to confirm the address first)', async () => {
    await fillAndSubmit();
    http.expectOne('/api/auth/register').flush(null, { status: 202, statusText: 'Accepted' });
    expect(sessionStorage.getItem('jtalk:token')).toBeNull();
  });

  it.each([
    [429, 'Too many attempts'],
    [500, 'Could not create your account'],
  ])('shows a message for a %i and keeps the form', async (status, message) => {
    await fillAndSubmit();
    http.expectOne('/api/auth/register').flush({}, { status, statusText: 'x' });
    await fixture.whenStable();

    expect(root().textContent).toContain(message);
    expect(root().querySelector('form')).not.toBeNull();
  });

  it('links to sign in', () => {
    expect(root().querySelector('a[href="/login"]')).not.toBeNull();
  });
});
