import { TestBed } from '@angular/core/testing';
import type { PartialMatchRouteSnapshot } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { type Observable, of, Subject } from 'rxjs';
import { signedOutGuard } from './signed-out.guard';

describe('signedOutGuard', () => {
  function run(signedIn$: Observable<boolean>): Observable<boolean> {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isAuthenticated$: signedIn$ } }],
    });
    const answer = TestBed.runInInjectionContext(() =>
      signedOutGuard({}, [], {} as PartialMatchRouteSnapshot),
    );
    return answer as Observable<boolean>;
  }

  it('matches for someone who is not signed in', () => {
    const answers: boolean[] = [];
    run(of(false)).subscribe((answer) => answers.push(answer));
    expect(answers).toEqual([true]);
  });

  it('does not match for someone who is signed in, so the app takes the address', () => {
    const answers: boolean[] = [];
    run(of(true)).subscribe((answer) => answers.push(answer));
    expect(answers).toEqual([false]);
  });

  it('waits until Auth0 has said who is there, and answers once', () => {
    const auth = new Subject<boolean>();
    const answers: boolean[] = [];
    run(auth).subscribe((answer) => answers.push(answer));
    expect(answers).toEqual([]);

    auth.next(true);
    auth.next(false);

    expect(answers).toEqual([false]);
  });
});
