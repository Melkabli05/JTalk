# Jtalk: working agreements

Angular 22 starter. Refer to the docs before writing code; do not rely on memory for Angular 22 or Optimus APIs.

- Angular: https://angular.dev (style guide: /style-guide; AI best practices: https://angular.dev/assets/context/best-practices.md)
- Optimus UI: https://optimus.openng.org/llms/llms.txt (per-component Markdown: /llms/components/<name>.md)
- Read installed types (`node_modules/@angular/*/types`, `@openng/*`) when the web docs are thin.

## Structure (mirrors the project owner's reference tree: keep it exact)

- `app/{core,layout,shared,features}`, with `core/{auth,http,error-handling,config}`, `layout/{shell,layout.routes.ts}`,
  `shared/{ui,pipes,directives,utils}`, `features/<x>/{pages,ui,data-access,state,models,<x>.routes.ts,<x>.ts}` (`state/` only when a feature has state worth a store, as `rooms` does).
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
- Feature state (`features/<x>/state/`): a `*.store.ts` holds the feature's state as signals (server data from data-access resources, plus what is
  derived from it) and has no behavior beyond changing that state; a `*.facade.ts` is the ONE thing a container injects: it exposes the store as
  `state`, owns the use cases (what the person does, refreshing, keeping a connection alive) by composing data-access, and reports what the page must
  react to (an `Observable`, e.g. `exited`). Containers keep only what is on screen: dialogs, confirmations, announcements, the router, i18n texts.
  A store reads each resource through `shared/utils/resource-value` (`loadedValue`: the value, or `undefined` while loading or failed, so `computed`s never throw) and a facade reads a status through `shared/utils/http-status`. A `provide<Feature>()` function in the facade file lists the store, the facade and what they need; the container puts it in its `providers`, so
  state and timers live and die with the page. Lint keeps stores and facades out of every presentational component.
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
- Look: `app-auth-layout` is a poster panel on the brand green (brand, slogan, `app-voice-bubbles`) beside the form column, collapsing to a
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
protect the app add `canActivateChild: [authGuard]` to the shell route in `layout.routes.ts`. Rooms: `RoomsFacade`/`RoomsStore` (hallway) and `RoomFacade`/`RoomStore` (one room) in `state/` are what the two pages inject. Room audio: `RealtimeService` (per room page, `data-access/`) holds the connection state as signals; `adapters/livekit.adapter.ts` is the only code that knows `livekit-client` (loaded on demand); specs swap it through the `REALTIME_CONNECTOR` token with `realtime-link.fake.ts`.

## Accessibility and safety

- Text from a model or a user is untrusted: render it as text or typed elements, never as HTML. Never use `innerHTML` or
  `bypassSecurityTrust*` (lint forbids both).
- Announce state changes once through the CDK `LiveAnnouncer` (the container's `say()`); screen-reader-only text uses the CDK's
  `.cdk-visually-hidden` (included once in `styles.scss`). A live region in a presentational component is a `role="status"` whose text changes.
- Icon-only buttons have an `aria-label` and an Optimus `pTooltip` (the same text; `@let` it once in the template); a toggle keeps
  one label and uses `aria-pressed`. Return focus sensibly after a dialog, a delete or a new item.
- Browser APIs get a util in `shared/utils` (`download-file`, `safe-storage`), never a call inside a component.

## Design system: Gather UI 2.0

Contemporary social audio, editorial minimalism, human warmth. All tokens live in `core/config/jtalk-preset.ts` (change them there, never per
component); the values are a design proposal and every step between them is a mix with white or black. Color: porcelain `#F7F5EF` canvas
(surface 50), paper `#FFFFFF` cards (surface 0), Forest Ink `#20251F` text; Forest `#477A5D` (Sage `#80B18D` in dark) means active and nothing
else (live, speaking, the primary action), Sand (Gold `#C9AF7E` in dark) means elevated room permissions, Terracotta (Coral `#DF8277`) means
danger: one color, one meaning, in both themes (`--p-jtalk-brand`, `-moderator`, `-danger`). Where a proposed value fails contrast the nearest
passing one is used: secondary text `#6A6C64` (not `#777970`, 4.05:1), filled danger `#B0574E`, field borders `#8F9187`; tertiary `#999B91`
is never text. Verify contrast numerically (text on fills >= 4.5:1, borders and indicators >= 3:1).
Shape hierarchy (`--p-jtalk-radius-*`): 10 controls, 12 fields, 16 cards, 22 feature panels, 26 sheets, 14 buttons (pills, `[rounded]`, in the
control dock), circular avatars. Three levels: the canvas is open (no boxes), interactive surfaces are paper with a hairline
(`--p-content-border-color`), the immersive stage is a panel one tonal step off the canvas (`--p-content-hover-background`). Shadows are almost
invisible (`--p-jtalk-elevation-1..3`: none, floating controls, dialogs and menus): use tonal contrast and borders.
Type: Manrope (Noto Sans Arabic falls in for Arabic), `--p-jtalk-type-*`: hero 36/700, title 28/700, section 21/650, card 17/650, body 15,
secondary 13/450, metadata 11/600; tabular numerals for counts and timers; no uppercase for ordinary text. Spacing: the 4px scale in
`styles/_tokens.scss` (`$space-*`). Motion: `--p-jtalk-motion-fast|normal|slow` (120, 180, 280ms), meaningful only (a speaking ring, press
feedback, status changes), never continuous when nothing happens, still under `prefers-reduced-motion`. Targets: 44x44px minimum for buttons
and fields (the preset enforces it). Initials avatars and room banners take `--p-jtalk-tone-{green,gold,coral}`. Dark is its own theme (night
`#151916` canvas, `#202720` surfaces), not an inversion. State is never color alone: speaking is a green ring plus a waveform badge, a muted
microphone is an icon and a label (muted is not danger), roles are labeled badges. The stage is an open centered composition whose avatar
size follows the speaker count; controls are grouped by importance (primary: leave and microphone; secondary: raise hand, sound; host last).
Never show a server-confirmed action as done before the server confirms it. No gradients or glassmorphism.

### The live room (`features/rooms/pages/room-page`)

Layout. One column on a phone (header, stage, the people, the dock); from 1024px a grid: header, stage and dock on the left, the people on the right behind a
hairline. The route is `wide`, the content stays 80rem. The grid areas follow reading order, so keyboard order is header, stage, people, dock.
Header. An icon-only back button, a still green dot with `Live · N in the room`, the title, the topic, and one muted line: flag, language, "for X speakers", "Hosted by Y".
No flag circle, no data card, no `Room details`: what the room is about and who hosts it is said once, in words (the Clubhouse case study found rooms that never say
what they are about, and screens without counts).
Stage. People, not furniture: portraits and names on the page itself (no panel, no visible heading; the heading is for screen readers), centered however many speak.
One speaker is a hero, up to four large, five to eight smaller, past eight it scrolls and whoever is heard comes first (the Clubhouse case study: a speaker out of sight is the
hardest to find). A muted microphone is a small badge on the portrait's corner, the host a crown and the word `Host` in a quiet caption, you `You`, speaking the ring (and a hidden
`Speaking` for screen readers). One open seat, not one per seat. People arrive with a short fade.
The people. `Listeners N` and the list: a collapsed `p-panel` with a few faces on a phone, a plain heading and list where there is room. The host's raised hands are a card above it.
The dock. A `Leave quietly` pill; in the middle the round icon buttons for the conversation (microphone for a speaker, the hand for a listener, a toggle with `aria-pressed`, both with
a tooltip and an `aria-label`); the host's actions behind a `...` menu whose items the page builds (so they are translated). It says nothing while all is well and speaks only
when audio is connecting, coming back, lost, or the microphone is refused. A crossed-out icon is `.pi-slashed` (the icon set has none). Not built yet: chat and reactions, a moderator
bottom sheet, speaker invitations to accept or decline, per-speaker mute from other people, room privacy and share.

### The hallway (`room-list-page` and `room-card`)

A room card answers what, who and how busy, and is a row of information, not a poster: one muted line (flag, language, "for X speakers"), the title, a two-line topic, the
people on stage **by name** with the host first and a crown (who is inside decides whether to join; the Clubhouse redesign studies keep coming back to it), "+N more", and a footer line
with a still green dot, "N in the room" and "Open seats: N" while there are some. The whole card is the way in: the title is the one real button, stretched over the card, with a quiet hover
and a focus ring on the card, so there is no second Join button and no "Live" label on cards that are all live. The page: the title and one concrete line, the language filter, a grid of
cards of equal height. Empty is two different states, said differently: no rooms at all ("Quiet right now", and the header's single Start a room button, not a second one), and a language with no
rooms ("Nothing in this language yet" with Show all rooms). Loading is skeleton cards.

### Not looking generated

Rules we hold ourselves to (sources: [DEV: fix the "AI-generated" look](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh), [Clubhouse room case study](https://medium.com/design-bootcamp/case-study-redefining-the-room-experience-for-clubhouse-a3bcd6d3081a)): no box
around what needs none (hierarchy by spacing and alignment, then a hairline, then a surface); one radius vocabulary; no stack of pills under a name (state sits on the thing it
describes: a badge on the portrait, a caption, the ring); asymmetry over a centered column of sections (a left-aligned header over a centered stage); words that say a concrete thing
("Hosted by Sarah", not a feature title); silence when all is well; every state besides the happy path (connecting, lost, refused, empty). Delete before adding. Read a screen
against a real app before shipping it, and check it right-to-left.

### Principles and where they come from

"Gather UI" is our own name for this system (from the design proposal); no public spec exists under that name, so every rule below is tied to a source. Check
a change against them before shipping:

- **WCAG 2.2** ([Understanding docs](https://www.w3.org/WAI/WCAG22/Understanding/)): 2.5.8 targets 24px (AA; we use 44px, the 2.5.5 AAA size, for buttons and fields);
  2.4.11 a sticky dock must not hide the focused control (`scroll-padding-block-end` on `html:has(app-room-page)` in `styles.scss`); 4.1.3 a state is a
  `role="status"` region, an error (audio lost, microphone refused) is `role="alert"`, and the end of a state is announced too (the microphone goes on and off through
  the CDK `LiveAnnouncer`); 2.2.2 nothing decorative moves for more than 5 seconds (an infinite animation is only for a live state that stops when the state does:
  the speaking ring); 1.4.1 and 1.4.11 never color alone, indicators at least 3:1; `forced-colors` keeps the speaking cue (an outline, since box-shadows are removed).
- **Discord Stage Channels** ([FAQ](https://support.discord.com/hc/en-us/articles/1500005513722-Stage-Channels-FAQ)): speakers above the audience, entry as a muted listener, no
  entry or exit sounds, "exit quietly", the request queue seen only by moderators, an invited person accepts before going on stage, moderators can turn requests off.
  Not built: the accept/decline invitation and the requests switch need backend support.
- **X Spaces and Clubhouse** (help pages, third-party guides): the microphone starts muted and takes a moment to be ready, a raised hand goes to a queue and never puts
  anyone on stage by itself, the host invites or accepts, a listener can take the request back.
- **Gather Town accessibility guide** ([article](https://support.gather.town/articles/1489858946-accessibility-best-practices-for-inclusive-space-design)): do not rely on
  color alone, label roles in text, respect reduced motion.
- Out of reach for now: live captions for audio (WCAG 1.2.9, AAA), an in-app reduce-motion switch (the system preference is honored).

### Optimus first, in the room (what is builtin, what is custom and why)

Builtin: the dock is a `p-toolbar` (start: leave, microphone, raise hand; center: status; end: host controls) with `p-message` for audio lost and a refused microphone
(it is `role="alert"` already); the listeners are a toggleable `p-panel` (collapsed, header with the count and a `p-avatargroup`); the side panels are `p-card`; `Live`, `Host`,
`Speaking`, `Muted` are `p-tag`; counts are `p-badge`; buttons are `pButton` (`[rounded]` for the dock's pills); the header and navigation are `p-menubar`; confirmations,
toasts, skeletons, avatars as before. Theming goes through preset tokens (`toolbar`, `panel`, `card`, `tag`, `button`, `avatar`), with a `css` hook only where no token exists
(minimum button height, the toolbar's shadow). Custom on purpose: the stage tiles and open seats (Optimus has no stage or seat), the speaking ring (no ring token), the
hand-raised list (a numbered list of person + action), the `.pi-slashed` crossed-out microphone (the icon set has none), the brand mark and voice bubbles (decorative), and the
stage's scroll past eight speakers (native overflow, which keyboards and screen readers already handle; `p-scrollpanel` draws its own bars). A `#end` template reference shadows a
component output named `end`, so the dock's output is `endRoom`.
