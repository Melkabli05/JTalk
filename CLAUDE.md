# Jtalk: working agreements

Angular 22 starter. Refer to the docs before writing code; do not rely on memory for Angular 22 or Optimus APIs.

- Angular: https://angular.dev (style guide: /style-guide; AI best practices: https://angular.dev/assets/context/best-practices.md)
- Optimus UI: https://optimus.openng.org/llms/llms.txt (per-component Markdown: /llms/components/<name>.md)
- Read installed types (`node_modules/@angular/*/types`, `@openng/*`) when the web docs are thin.

## Structure (mirrors the project owner's reference tree: keep it exact)

- `app/{core,layout,shared,features}`, with `core/{auth,http,error-handling,config}`, `layout/{shell,layout.routes.ts}`,
  `shared/{ui,pipes,directives,utils}`, `features/<x>/{pages,ui,data-access,models,<x>.routes.ts,<x>.ts}`.
- File names use suffixes: `*.component.ts`, `*.service.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.pipe.ts`, `*.directive.ts`,
  `*.models.ts`/`*.model.ts`/`*.dto.ts`, `*.token.ts`, `*.routes.ts`. Component classes end in `Component`.
  Generate with `ng generate @schematics/angular:<kind>` (configured in angular.json). Do not add folders the tree does not have.
- `features/<x>/<x>.ts` is the public API; `app.routes.ts` lazy-loads features through it.

## Optimus first (standing rule from the owner)

Always prefer an Optimus builtin over building a component. Check https://optimus.openng.org/llms/llms.txt before writing UI, and
only build when nothing fits (say why). Current mapping: header and navigation one `p-menubar` (brand in `#start`, actions in `#end`, inside `<nav aria-label="Primary">`; it collapses to a menu button on phones),
breadcrumb `p-breadcrumb`, record lists `p-table` with its own paginator (`[paginator]`, `[alwaysShowPaginator]="false"`), `pSortableColumn` + `p-sortIcon`, and a `p-iconfield` search calling `table.filterGlobal` (never hand-rolled paging, sorting or filtering), buttons the **`pButton` directive** (never `<p-button>`: 2.0.2 adds a native
`autofocus` attribute; link buttons are `<a pButton routerLink>`), status `p-tag`, errors `p-message` (`variant="simple"` for field
errors), loading `p-progress-spinner` with `ariaLabel` (wrap in `.loading`), success feedback `MessageService.add` + the one app-wide `<p-toast />` (in `app.html`, provided in `app.config.ts`), confirmations `ConfirmationService` + `<p-confirmdialog />`
in the container page, pictures `p-avatar` (profile pictures, with initials as the fallback), `p-avatar-group` (stacks of thumbnails with a "+n" overflow) and `p-image` (`[preview]` gives click-to-enlarge; not `NgOptimizedImage`), inputs `pInputText`, currency/number inputs `p-inputnumber`. Plain HTML on purpose: the `<dl>` of details (Optimus has no description list) and the `.loading` wrapper. Custom on purpose: `text-field` and `number-field` (thin Signal Forms controls around the Optimus inputs; `[formField]` alone would flag pristine fields invalid), `appAriaCurrent` (+ preset CSS) because `p-menubar` neither styles nor marks the current link.

## Conventions

- No `standalone: true`, no explicit `OnPush` (both are v22 defaults). Zoneless. Strict TypeScript and templates.
- `@Service()` + `inject()` (`@Injectable()` only for `useClass` providers). Signals, `input()`/`output()`/`model()`, `computed()`.
  `@if`/`@for`/`@switch`, `@let`. Output names must not match DOM events (`select`, `cancel`, ...).
- Reads: `httpResource` created by the data-access service, `parse` from the adapter (validates the response and maps DTO -> model),
  read in templates behind `hasValue()` (`value()` throws in the error state). `rxResource` only for non-HTTP streams.
  Writes: `HttpClient` Observables run through `saveRequest()` (`shared/utils/save-request`: `submitting`, `error`, `run(request, { next, failure })`).
  Never `firstValueFrom`, never `httpResource` for POST/PUT/DELETE.
- Container specs use the real data-access service + `HttpTestingController`; in a spec call `TestBed.tick()` to start a resource and
  `await fixture.whenStable()` after flushing (never before, it waits for the pending request).
- Signal Forms with `[formRoot]`; use `app-text-field` / `app-number-field` for inputs. Do not bind `[invalid]` on `[formField]` hosts.
- Smart/dumb: services, the router and data loading live ONLY in containers, in every feature. A container is exactly one file:
  `pages/<x>-page/<x>-page.component.ts` or `layout/shell/app-shell.component.ts` (a page's own `ui/` is NOT exempt). Every other
  component is presentational: `input()`/`output()` only. Lint rejects, outside containers: `inject()`, constructor parameters, `providers`,
  `Injectable`/`Service`/`Injector`/`resource`, `rxResource`/`toSignal`, `@angular/common/http`, any value import from `@angular/router`
  (even `RouterLink`), `*.service|store|facade` files, `data-access/` and `state/` imports, and value imports from `@core/*`. Pipes, type-only
  imports and third-party UI (Optimus) are fine. A presentational component never navigates: it emits an `output()` and the container calls the router. A routed page is a container, so name it `*-page` and put it in `pages/`.
  Never silence the rule.
- A feature may have `utils/`: pure functions over its models (reducers, parsers, date grouping), tested without
  a component. Lint keeps them away from `data-access/`, `ui/`, `pages/` and other features. The library types are ES2024, so use
  `findLast`, `toSorted`, `Map.groupBy`, `Promise.withResolvers` instead of re-implementing them.
- Layout: `features/` and `layout/` -> `core/`, `shared/`; `core/` -> `shared/`; `shared/` -> nothing. Features never import each
  other; only `app.routes.ts` wires `layout/` and `features/`. ESLint enforces this; never silence it.
- Shared helpers: `shared/utils/form-submission` (submit + focus-first-error for Signal Forms), `save-request` (state of a write),
  `unsaved-changes` (discard guard), `as-record` (response checks), `form-harness` (spec helper for field forms). Field controls
  (`text-field`, `number-field`) extend `shared/ui/field-control.directive`; the system color scheme comes from the CDK `BreakpointObserver`. Do not
  copy-paste these into features.
- Layout numbers live in `styles/_tokens.scss`. Keep it simple: no abstraction until a second use exists.
- Lint also enforces modern Angular (`prefer-signals`, `prefer-signal-model`, `prefer-output-emitter-ref`, `prefer-host-metadata-property`,
  `prefer-service-decorator`, `inject-at-top`, template `prefer-*` rules for control flow, built-in pipes, class/style bindings, `button-has-type`).
- Every new behaviour gets a spec. Run `pnpm check` before finishing (lint, format, tests, the mock's own tests, build).

## Languages and direction (README "Languages (i18n)" and "Right-to-left")

- English and Arabic, runtime switch. Text is keyed by its English wording: `| t` in templates (presentational components may use
  the pipe), `I18n.t` in containers, `msg('...')` for text kept in constants, routes and validation messages. Every text needs
  its entry in `shared/utils/i18n/ar/messages.ts`; `pnpm i18n:check` fails for a missing or an unused one. Keep texts literal
  (`cond ? ('A' | t) : ('B' | t)`, a `msg` map) so the check can see them.
- Dates and money: built-in pipes with `locale()` as the locale argument (containers expose `locale = inject(I18n).locale`;
  presentational components take a `locale` input).
- `I18n` is a service: containers inject it, presentational components only use the `t` pipe, `msg` and the types in `locales.ts`.
  Switching goes through `LocaleService` (core), which also sets the direction. The switch itself is `app-locale-switch`
  (Optimus `p-selectbutton`).
- No comments in the code.

## Routing (from the angular.dev routing guides)

- Order routes specific -> general; `**` last; every route has a `title`; `pathMatch: 'full'` on root redirects.
- Features lazy-load at their boundary (`loadChildren`) and are preloaded (`withPreloading(PreloadAllModules)`); the shell shows a
  progress bar while `router.currentNavigation()` is set.
- Route data and params reach pages as `input()` (`withComponentInputBinding`); static metadata goes in `data` (breadcrumbs).
- Guards are functional and redirect with a `UrlTree`; client guards are convenience, the API must enforce access.
  Pages that hold edits implement `HasUnsavedChanges` and the route uses `canDeactivate: [unsavedChangesGuard]`
  (`shared/utils/unsaved-changes`); a saved form sets its `saved` flag before navigating.
- After a save navigate with `replaceUrl: true` so Back does not return to the form.
- Test routes with `RouterTestingHarness` and real route configs; never mock the Router for behavior.

## Auth (from OWASP Authentication Cheat Sheet, NIST SP 800-63B-4 and MDN)

- Account pages are `core/auth/pages/{login,register,forgot-password,reset-password}-page`, routed by `core/auth/auth.routes.ts` outside the
  shell. Signed-in users are redirected away from sign-in/register/forgot (`guestGuard`).
- Never reveal whether an account exists: sign-in has one error for every bad credential; register and forgot-password show the same
  confirmation for any address; 429 shows "slow down". Lockout and rate limits belong on the API.
- Built in, nothing hand-rolled: Signal Forms (`form`, `[formRoot]`, `required`/`email`/`minLength`, `submission`, `focusBoundControl`), Optimus
  `pInputText`, `p-password` (+ `p-fluid`), `pButton` (also for links: `<a pButton [text]="true">`), `p-message`, `p-toast`. Custom only where Optimus has
  no equivalent: the field wrappers (they bridge Optimus inputs to Signal Forms and show errors only after touch; `p-password` also has no
  `aria-invalid`/`aria-describedby`), the poster layout and brand mark, and the account logic (service, guards, interceptors).
- Look: `app-auth-layout` is a Bauhaus poster panel (ink ground, brand, slogan, four primary blocks) beside the form column, collapsing to a
  band on phones; every account page passes a `heading` and a one-line `lead`. The four forms share `core/auth/ui/auth-form.scss`, and the
  brand mark is `shared/ui/brand-mark` (also used by the shell header).
- Error text comes from `authFailure(fallback, { status: message })` (429 is always "slow down"); the sign-in redirect URL is built in one place,
  `loginUrl()` in `auth.guard.ts`. Field errors render through `app-field-errors`. The `pButton` directive only styles `[loading]` (no native `disabled`), so bind `[disabled]` as well.
- Passwords: minimum 12 (`MIN_PASSWORD_LENGTH`), no composition rules, spaces and Unicode allowed, never trimmed, paste allowed, show/hide
  toggle (`app-password-field` = Optimus `p-password`, no strength meter). `autocomplete` is `username`/`email`, `current-password` or `new-password`.
- The session token is in `sessionStorage` (readable by script, so XSS matters); a backend-set httpOnly SameSite cookie is safer, and
  Angular's built-in XSRF protection (`XSRF-TOKEN` cookie -> `X-XSRF-TOKEN` header) already covers cookie sessions if the API validates it.

## Current state

The live-communication frontend (the Micronaut backend `live-communication-service`, `/api` and `/dev` proxied to port 8080). `features/rooms` is the one
feature: the hallway (`room-list-page`) and a room (`room-page`), with `RoomsApiService`, `ParticipantsApiService` and `StageApiService` as the only code that knows
the endpoints, polling and the heartbeat in the `room-page` container, and no mock data. Identity lives in `core/auth/identity.service.ts`: in a development build the
person fills in a profile (a name, a picture chosen from the ten in `public/avatars/` by id, and two languages; kept in this browser, registered with the backend's `POST /dev/users`) before the shell shows any page, and `devIdentityInterceptor` sends its id
as `X-User-Id`; with a token the user id is the token's subject. A user service will replace this. The mock API has only the account endpoints (`pnpm start:mock`).
Account pages are listed under Auth (sign-in honors a safe `?returnUrl=`). `authGuard` is not applied to any route on purpose (auth is off while testing); to
protect the app add `canActivateChild: [authGuard]` to the shell route in `layout.routes.ts`. The LiveKit audio client is not added yet.

## Accessibility and safety

- Text from a model or a user is untrusted: render it as text or typed elements, never as HTML. Never use `innerHTML` or
  `bypassSecurityTrust*` (lint forbids both).
- Announce state changes once through the CDK `LiveAnnouncer` (the container's `say()`); screen-reader-only text uses the CDK's
  `.cdk-visually-hidden` (included once in `styles.scss`). A live region in a presentational component is a `role="status"` whose text changes.
- Icon-only buttons have an `aria-label` and an Optimus `pTooltip` (the same text; `@let` it once in the template); a toggle keeps
  one label and uses `aria-pressed`. Return focus sensibly after a dialog, a delete or a new item.
- Browser APIs get a util in `shared/utils` (`download-file`, `safe-storage`), never a call inside a component.

## Design system: Bauhaus

Do not invent colors or patterns. Tokens come from published, human-designed systems (Radix Colors) via
`core/config/jtalk-preset.ts`; see README "Theme: Bauhaus". Rules: flat primary-color blocks on black/white/grey, radius 0 (the
avatar is the one circle), no shadows (hard borders instead), no gradients or glassmorphism, Jost for headings/buttons and Atkinson
Hyperlegible for text, color never the only carrier of state. Change tokens in the preset, not per component.
Verify contrast numerically (white text on solids >= 4.5:1, borders >= 3:1).
