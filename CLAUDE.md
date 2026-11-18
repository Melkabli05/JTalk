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
- Reads: `httpResource` created by the data-access service, `parse` from a parser in `data-access/parsers/` (validates the response and returns the model),
  read in templates behind `hasValue()` (`value()` throws in the error state). `rxResource` only for non-HTTP streams.
  Writes: `HttpClient` Observables run through `saveRequest()` (`shared/utils/save-request`: `submitting`, `error`, `run(request, { next, failure })`).
  Never `firstValueFrom`, never `httpResource` for POST/PUT/DELETE.
- Container specs use the real data-access service + `HttpTestingController`; in a spec call `TestBed.tick()` to start a resource and
  `await fixture.whenStable()` after flushing (never before, it waits for the pending request).
- Signal Forms with `[formRoot]`; use `app-text-field` for inputs. Do not bind `[invalid]` on `[formField]` hosts.
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
  `as-record` (response checks), `form-harness` (spec helper for field forms). Field controls
  (`text-field`, `password-field`, `select-field`, `avatar-picker`) extend `shared/ui/field-control.directive`; the system color scheme comes from the CDK `BreakpointObserver`. Do not
  copy-paste these into features.
- Layout numbers live in `styles/_tokens.scss`. Keep it simple: no abstraction until a second use exists.
- Lint also enforces modern Angular (`prefer-signals`, `prefer-signal-model`, `prefer-output-emitter-ref`, `prefer-host-metadata-property`,
  `prefer-service-decorator`, `inject-at-top`, template `prefer-*` rules for control flow, built-in pipes, class/style bindings, `button-has-type`).
- No comments in code (TypeScript, templates, styles): names and structure carry the meaning. Explain in the README or CLAUDE.md, not in the source.
- Every new behaviour gets a spec. Run `pnpm check` before finishing (lint, format, tests, i18n, build).

## Languages and direction (README "Languages (i18n)" and "Right-to-left")

- English and Arabic, runtime switch. English is the default (`DEFAULT_LOCALE` and the static `<html lang="en" dir="ltr">` with its boot script in `index.html`); a saved choice always wins, so a returning Arabic user stays Arabic and right-to-left. Text is keyed by its English wording: `| t` in templates (presentational components may use
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
- After a save navigate with `replaceUrl: true` so Back does not return to the form.
- Test routes with `RouterTestingHarness` and real route configs; never mock the Router for behavior.

## Auth (Auth0; OWASP Authentication Cheat Sheet and MDN for the rest)

- Signing in is Auth0's Universal Login (`@auth0/auth0-angular`): no account pages, no password field, no token handling of our own. `provideAuth0` in
  `app.config.ts` sets the tenant, the SPA's client id and the API audience (`environment.ts`, none of it secret), keeps refresh tokens in
  `localStorage` (falling back to a silent sign-in), and its `authHttpInterceptorFn` adds the access token to calls under `/api` only.
- `layout/layout.routes.ts` guards the shell with the SDK's `authGuardFn`: someone not signed in is sent to Auth0 and returned to the page they asked
  for. Do not add our own guard or interceptor for this; use the SDK's.
- Specs never call Auth0 (a browser round trip): `fakeAuth0()` in `core/auth/auth-testing.ts` stands in for the SDK, and `fakeIdentity()` for
  `IdentityService` in specs about rooms, where only "who am I" matters. Everything after that, the user service included, is real code answered by
  `HttpTestingController`.
- Never reveal more than the API does; show its message through the usual problem handling, and keep tokens out of logs, URLs and templates.
- The SDK keeps the session in `localStorage` (readable by script, so XSS matters); the CSP and the no-`innerHTML` rule under Accessibility and safety
  are what protect it.

## Current state

The live-communication frontend (the Micronaut backend `live-communication-service`, `/api` proxied to port 8080). `features/rooms` is the one
feature: the hallway (`room-list-page`) and a room (`room-page`), with `RoomsApiService`, `ParticipantsApiService` and `StageApiService` as the only code that knows
the endpoints, polling and the heartbeat in the `room-page` container, and no mock data. Identity lives in `core/auth/identity.service.ts`: Auth0 signs the person in, and the user service (`core/auth/users-api.service.ts`, the only code that knows its endpoints) says who they are. A signed-in person
it does not know yet fills in a profile (a name, a picture chosen from the ten in `public/avatars/` by id, and two languages) before the shell shows any page; it is stored in the user service, the picture as the path of the bundled image. A profile is read and written in one request: `GET /me` carries the languages spoken and learned (`Person.languages`, and `learning` is the first one learned), and `IdentityService.saveProfile()` is one `POST`/`PATCH /me` that includes `learningLanguages` (only when it changed, since it replaces the list and its levels) and whose answer becomes the profile shown, with no read back; a person card gets the same from `GET /{id}`. `IdentityService.resolve()` looks other people up in one batched call, which `RoomListStore` and `RoomStore` ask for, so rooms show names and pictures. `/api/v1/users` is proxied to the user service and the rest of `/api` to the live communication service (`proxy.conf.json`, `vercel.json`). Rooms: `RoomListFacade`/`RoomListStore` (hallway) and `RoomFacade`/`RoomStore` (one room) in `state/` are what the two pages inject. Room audio: `RealtimeService` (per room page, `data-access/`) holds the connection state as signals; `data-access/livekit.connector.ts` is the only code that knows `livekit-client` (loaded on demand); specs swap it through the `REALTIME_CONNECTOR` token with `realtime-link.fake.ts`.

## Accessibility and safety

- Text from a model or a user is untrusted: render it as text or typed elements, never as HTML. Never use `innerHTML` or
  `bypassSecurityTrust*` (lint forbids both).
- Announce state changes once through the CDK `LiveAnnouncer` (the container's `say()`); screen-reader-only text uses the CDK's
  `.cdk-visually-hidden` (included once in `styles.scss`). A live region in a presentational component is a `role="status"` whose text changes.
- Icon-only buttons have an `aria-label` and an Optimus `pTooltip` (the same text; `@let` it once in the template); a toggle keeps
  one label and uses `aria-pressed`. Return focus sensibly after a dialog, a delete or a new item.
- Browser APIs get a util in `shared/utils` (`safe-storage`), never a call inside a component.

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
when audio is connecting, coming back, lost, or the microphone is refused. The dock is a floating paper capsule (a pill-shaped `p-toolbar`) that uses the system's own colors through the preset and no overrides: paper surface with the hairline, Forest (Sage in dark) for what is live, tonal neutrals for the rest, an outlined `Leave quietly`; the host's Edit and End are in the header (Sand `severity="warn"` and danger). `start` holds the main action and `React`; `end` holds `Leave quietly`, a quiet outlined pill, never the strongest thing. The main action is a labeled tonal pill that keeps one width so toggling does not shift the row: the microphone for a speaker (live-colored when on, tonal and slashed when muted), `Raise hand` for a listener (tonal, live-colored when raised, `aria-pressed`, label never changes). `React` is a round text icon that opens a `p-popover` (below). In a dock narrower than 30rem the leave pill keeps only its icon (a container query on the `dock` container, `leave-compact`, in the button's `css` hook: Optimus has no responsive label), and its `aria-label` stays. A problem carries its own way out: `Audio is not available.` has `Reconnect audio`, `Sound is off in this browser.` has `Turn on sound`, both inside their `p-message`, never as dock buttons. Notes above the dock fade in. Reactions (Tandem-style, everyone in the room): a `React` icon button in the dock opens a `p-popover` of ten icon buttons in two rows (heart, clap, thumbs up, smile, sparkles, fire, party, laugh, wow, thanks: icons, never emoji, drawn as the flat colored Fluent Emoji SVGs (MIT, `public/icons/reactions/`, with its LICENSE; the flat set, not the gradient Color set, because the system has no gradients), shown with `NgOptimizedImage` (lint requires `ngSrc` for every image); `REACTIONS` in `models/reaction.model.ts`, looks in `utils/reactions.ts`). A tap calls `RoomFacade.react` (ignored within half a second, a 429 is silent), the server tells the whole room in one batched `REACTIONS` event, and only then does the person see it: `RoomStore.floating` holds it for 2.4 s and `RoomStore.reactionsByPerson` hands the latest one of each person down, so it pops on that person's own picture (`app-person-avatar`'s `reaction` input: the flat colored art centered over the picture at 64% of its size with no background, only a thin paper edge and a soft shadow so it reads on every avatar color, decorative and `aria-hidden`; it springs in with a small overshoot and wiggle, a brand-colored ripple ring leaves the avatar once, it holds, then rises and fades over the 2.4 s; a new one replaces the old and plays again) on the stage tile, in the audience list and, because the listeners panel is closed on a phone, among the few faces in its header (whoever just reacted is moved to the front of them). Under `prefers-reduced-motion` it appears and disappears without moving and the ripple is not drawn. A crossed-out icon is `.pi-slashed` (the icon set has none). Not built yet: chat, a moderator
bottom sheet, speaker invitations to accept or decline, per-speaker mute from other people, room privacy and share.

**Staying in the room while elsewhere.** The room belongs to the app, not to the page: `RoomFacade`, `RoomStore` and `RealtimeService` are app-level singletons, so going to another route (People, your profile, the hallway) does **not** leave the room: the audio keeps playing, your seat and hand stay, events keep arriving. The room page only shows it. `enter(id)` for the room already joined (coming back) changes nothing; for another room it leaves the first. What ends the room is the person leaving (`Leave quietly`, or **signing out**, which asks `ActiveRoomService.leave()` first), the host removing them, or the room ending; the facade itself says why in a toast wherever they are, and the room page navigates to the hallway only if it is the page showing. Layers: the feature cannot be imported by the shell, so `core/rooms/active-room.service.ts` holds `{ id, title }` of the room (filled and cleared by the facade, which also registers how to leave) and the header reads it. **The header badge**: while you are in a room and not on its page, an outlined Forest pill `a pButton` (a beating dot, because Forest means live, and the title cut with an ellipsis; the full title in `aria-label` and a tooltip) sits at the end of the menubar before the account button and links back to `/rooms/:id`; it is gone on the room's own page and once the room is left. **A reload does not leave the room either**: the room is written to this tab's session storage (`jtalk:room`, which a reload keeps and closing the tab does not), and at start-up an app initializer (`restore-room.ts`, lazy, at the app root because it needs the rooms feature) waits for Auth0 to say someone is signed in and joins that room again, so the badge and the audio come back wherever the person was (a browser may hold the sound until a tap: the room page offers `Turn on sound`); a room that cannot be joined, or no one signed in, forgets it. The facade does not clear the remembered room while it is still being rejoined (only after it has been announced and then left, or when the join fails). Closing the tab does not call leave (the server's grace lease handles it), and it is how a person really leaves without pressing Leave.

**Actions in the room.** The small things are round icon buttons of the system (`pButton`, `[rounded]`, icon only, with an `aria-label` and a tooltip); the one main thing is a labelled pill. **The dock** is one pill-shaped `p-toolbar` capsule, centered and as wide as its content (`fit-content`, `justify-content: center` since a lone toolbar slot sits at the start), holding in its centre slot: the microphone (a circle, Forest while it is on, neutral outlined while off), **Raise hand** (the main pill, Forest filled, outlined while the hand is raised, `aria-pressed`; only for listeners), react (a neutral circle, its popover outside the flex row so an empty element adds no gap), a hairline, and **Leave quietly** (a soft terracotta pill: outlined `danger` with a faint tint; on a narrow dock, under 30rem, its label hides and it is a circle, which the `leave-compact` rule in the preset does, and the Raise hand pill shrinks). The header's host actions are circles with a short caption under each, `Edit` (Sand) and `End` (terracotta, asks first), and so are the actions on the person card (see below).

**Only what the person can do.** An action that cannot work is not shown (not greyed out): the dock offers the **audience** a hand to raise, a reaction and a way out; someone **on the stage** the microphone, `Step down to the audience` (`canStepDown`, not for the host, who keeps the stage), a reaction and a way out, and no hand; the **host** the microphone, a reaction and a way out. The microphone appears only while the audio is `connected` (nothing to speak into while it is connecting, reconnecting or lost, when the message above the dock says so and offers to reconnect), and stays when the browser refused it so it can be tried again. The host's invitation (`To the stage`, the seat menu's `Invite to the stage`, and `Invite` on a raised hand) is offered only while there is a free seat (`seatFree`); `Mute` only for a speaker who is not already muted; `To the audience` only for a speaker; `Remove` and `Block` never on yourself or (for Remove) when you are not the host; the header's `Edit` and `End` only for the host.

### The hallway (`room-list-page` and `room-card`)

A room card answers what, who and how busy, and is a row of information, not a poster: one muted line (flag, language, "for X speakers"), the title, a two-line topic, one
row of people: the host **by name** with a crown, then the others on stage as faces only (their names in a tooltip, and in hidden text for screen readers; who is inside decides whether to join, so recognising a face matters), "+N" past four, and a footer line
with a still green dot, "N in the room" and "Open seats: N" while there are some. The whole card is the way in: the title is the one real button, stretched over the card, with a quiet hover
and a focus ring on the card, so there is no second Join button and no "Live" label on cards that are all live. The page: the title and one concrete line, the language filter, a grid of
cards of equal height. Empty is two different states, said differently: no rooms at all ("Quiet right now", and the header's single Start a room button, not a second one), and a language with no
rooms ("Nothing in this language yet" with Show all rooms). Loading is skeleton cards shaped like a real card (meta line, title, topic, faces, counts), announced as `Finding open rooms` (never a vague "Loading"); cards fade up when they arrive (a short stagger for the first six) and fade out when a room ends or the filter hides them, so people can follow what changed (`animate.enter` / `animate.leave`); a failed load is a `p-message` that carries its own `Try again`. The language filter's unselected labels use `surface.600` (4.58:1; the Aura default measured 2.75:1) through the preset's `togglebutton` token.

### People: the room popup and the profile pages

One people layer, three places. `core/people` reads and writes what the user service already has (`PeopleApiService`: profile, social stats, language matrix, follow, unfollow, block) and `PersonCardService` puts one person together (`PersonCard`: details, social, languages, and `match`); containers provide it per page (`providers`) and call `show(id)`. It never assumes a write worked: follow, unfollow and block reload the social stats afterwards. Pure rules live in `shared/utils/people.ts` (`partnerMatch`, proficiency levels, `flagOf`, `countryNameOf`, `compactCount`) and the shared display pieces in `shared/ui` (`app-follow-button`, `app-social-stats`, `app-language-levels`, `app-partner-match`), so a feature never imports another.

The idea, from HelloTalk and Clubhouse, in Gather's voice. **A language-exchange match** says whether someone is a real partner for you, from the two language lists: `Language exchange match` (they speak what you learn and learn what you speak, the one note with a Forest tint), `Can help you practise`, `You can help them practise`, or nothing. **Follow** is one button: `Follow`, `Follow back` when they already follow you, `Following` (outlined; pressing it unfollows; no confirmation, it is undoable), disabled while the request runs and hidden until it is known whether you follow them. The numbers are `Followers` and `Following` (compact: 1.3K) and a quiet `Follows you` tag. Languages show what they speak and what they learn with a four-step level (Beginner to Fluent) as a thin `p-progressbar` **and** the level in words, never color alone. Block sits in the `⋯` menu (on the popup and on `/people/:id`) and asks first, with a confirmation that says exactly what it does (it removes follows both ways and hides you from each other in search and suggestions).

**Moderation from a seat.** As the host, anyone on the stage or in the audience has a menu with no button of its own (`app-moderation-menu` wraps the seat and drives a popup `p-menu`, anchored under it): it opens when the mouse rests on the seat for a moment (350 ms, so passing over does not flash menus; it closes a moment after the pointer leaves the seat _and_ the menu), on a **long press** on a touch screen (500 ms; a finger that moves more than 10 px is scrolling; lifting after the press cancels `touchend` so the click does not also open the person), and on a right click or the keyboard's menu key. The seat stays an ordinary button: pressing it opens the person, whose card has the same actions for anyone who cannot hover or hold. The menu has `Mute` (speakers whose microphone is not already muted), `Move to the audience` or `Invite to the stage`, a separator, then `Remove from the room` and `Block` in terracotta (`linkClass: 'danger-item'`); Remove and Block still ask first. The room page builds the items (`moderation`, a map by id) and passes them down through `app-stage-seats` / `app-audience-section` / `app-audience-grid`; the host's own seat and yours get none, and a seat with no items behaves as if the wrapper were not there (the wrapper and its inner element are `display: contents`, so layout is untouched; a presentational component cannot inject, so it uses `viewChild`, template listeners and `OnDestroy`). **Mute** is `POST /stage/mute/{userId}` (host only): LiveKit mutes the speaker's microphone on the media server, and the speaker can unmute themselves. Everyone sees the result: the connector reports `TrackMuted`/`TrackUnmuted` (and the state when a track is first heard) as `microphoneMuted(identity, muted, local)`, `RealtimeService.muted` holds who is muted, the seat shows the mic-off badge, and for the person muted the button flips to `Unmute` (`micOn` follows the server).

**The People hub (`/people`, `PeoplePageComponent`)** is where the user service's social endpoints become screens, in a `p-tabs` bar whose panels are lazy and whose lists are read the first time they are looked at: **Discover** (`GET /users/matchmaking`, partners who speak what you learn and learn what you speak; keyset-paged: the next page is asked for with the last person's `createdAt` and `id`), **Search** (`GET /users/search?q=`, after a 300 ms pause in typing and at least two letters, with an announced result count), **Following** and **Followers** (`GET /users/{me}/following|followers?page=`, newest first, paged by number) and **Blocked** (`GET /users/me/blocks`, with `Unblock` = `DELETE /users/{id}/block`). A row (`app-person-row`: picture, name, one quiet line of handle, country and the language they speak; pressing it opens `/people/:id`) has what fits where it is: Follow/Following in Discover, Search and Following (a person unfollowed in Following keeps their row, so it is undoable), Unblock in Blocked, nothing in Followers (their profile shows the real state). `app-people-list` draws the states around any list (placeholders, a failure with Try again, an empty state that says what to do, Show more); `pagedList` (`shared/utils/paged-list.ts`) is the reusable reader behind each list (first page once, next page from a cursor, reload, remove); `PeopleDirectory` (a service provided by the page) owns the lists, the search and the follow state so the buttons agree across tabs. `Page`/`PersonSummary` live in `shared/` so presentational rows can use them. `People` is in the main navigation. In Gather terms: the tabs sit on the open canvas (the preset gives `tabs` a transparent list and panel, a hairline, and 44px tabs), rows are open (a tonal hover, no boxes), a person without a picture is drawn in one of the three tones (`avatarColors` in `shared/utils/avatars.ts`, the same function the room avatars use), and Forest appears only on the active tab and the Follow action.

The room popup (`person-dialog`) is a card with **no title bar** (`[showHeader]="false"`; the name is the `h2` and labels the dialog), built edge to edge (`styleClass="person-card"`; the dialog preset gives it no padding, each part keeps a `--gutter`) and **only from preset tokens** (`--p-jtalk-radius-*`, `--p-jtalk-type-*`, `--p-jtalk-brand`, the 4px spacing scale; no literal colours, radii or font sizes). Top to bottom: a **strip** with one quiet line saying where they are and what their microphone is doing (`Speaker · On mic`, `Speaker · Speaking`, `Speaker · Muted`, `Listener · In the audience`, `· You` for yourself; sentence case, no uppercase), then a `View profile` text button and the close icon, over a hairline; the avatar, the name, `@handle · Joined October 2026` and the country (no stack of tags under the name: the state is in the strip and on the picture); **Forest means live and nothing else**, so there is no standing ring: the avatar's own speaking ring and the strip's beating dot appear only while they are heard, and the **mic badge** on the avatar's corner (on stage only) is Forest when the microphone is open and a neutral slashed badge when muted (muted is not danger); a **full-width Follow** (`app-follow-button [block]`); for the contextual actions a centered row of **circles**: ordinary icon-only `pButton`s (`size="large"`, `[rounded]`, `[outlined]`, 48px, each with an `aria-label` and a tooltip) with a short caption of ours under each (`aria-hidden`, the button already has its name): `Mute mic` (disabled and `Muted` once muted) and `To the stage` in **Sand** (`severity="warn"`, whose outlined border the preset defines), `To the audience` and for yourself `Step down` neutral (`secondary`), and for the host `Remove` in **terracotta** (`danger`; it asks first); the numbers and the languages in one line (`Spanish (Native) · Japanese (Intermediate)`) set apart by hairlines, not a box; the match note; the bio; a collapsed `p-accordion` (`Safety`, or `Moderation and safety` for the host) holding `Block` (asks first). Nothing is shown that is not known (no verified tick, no co-host, no mutuals: the service has none of them). The room page decides what is allowed (`canMute`, `canRemove`, `canBlock`) and handles the outputs. On a phone (under 40rem) it is a **bottom sheet** with the sheet radius (`--p-jtalk-radius-sheet`): full width, rising from the bottom edge, bottom safe-area respected (the preset overrides the dialog's inline centering with `!important`, the only thing that beats it). The accordion is restyled as a quiet disclosure in the preset (no box). While the profile loads the host still has their tiles, plus placeholders. `/people/:id` (`PersonPageComponent`) is the same facts on a page (the hero with the flag badge on the picture, a compact follow button and `⋯` menu (Block) on the cover edge, the stats; then an `About` card (bio, the match) and a `Languages` card (what they speak, what they learn with levels) side by side when there is room, one column on a phone, and no `About` card at all when there is nothing to put in it); `/profile` is your own page with the same hero and `About`, your numbers, and the edit form. The edit form now also takes `About you` (a bio of up to 300 characters, `app-textarea-field`; Signal Forms binds `maxLength` from the validator, never bind it) and `Where you live` (a country, named in the reader's language with `Intl.DisplayNames`). A new profile omits an empty bio; an update sends it, so a bio can be cleared; a country cannot be unset once chosen (the service accepts only a code).

### Using Optimus as its docs say

Read the component's page before using it (`https://optimus.openng.org/llms/components/<name>.md`, listed in `llms.txt`); what the docs state, and we follow:

- **Menu** (`popup`): `menu.toggle($event)` from the trigger; the component sets the trigger's `aria-haspopup`, `aria-expanded` and `aria-controls` itself, so never add them by hand; label the menu with
  `ariaLabel`; style one item with the item's `linkClass` (our danger item), never a template of our own.
- **Popover**: `op.toggle($event)`, `appendTo="body"`, `ariaLabel`; it sets `aria-expanded` and `aria-controls` on the trigger and moves focus in; Escape returns it.
- **Panel**: two-way `[(collapsed)]` with a signal, `toggler` for what opens it, `toggleButtonProps` for the toggle's label.
- **Avatar**: no roles by default, so an informative one gets `ariaLabel` and a decorative one `aria-hidden`; sizes only by the `--p-avatar-*` and `-xl-*` tokens (our hero size); the group's overlap and border by
  its tokens. There is no ring or status pattern in the docs: the speaking ring and the mic badge are ours, on purpose.
- **Toolbar**: `ariaLabelledBy`; it has no keyboard handling of its own, so its buttons follow the page's tab order.
- **Tooltip** is advisory only: an icon-only button always also has an `aria-label`.
  Dead code goes: the skeleton's stage marker and the theme hooks that only served it are gone; `copy-button`, `number-field`, `download-file`, `speech-input` and `unsaved-changes` were unused and are removed.

**Deleting the account** (`/profile`, last card, `.danger`: terracotta heading, an outlined danger `Delete my account`). It opens `app-delete-account-dialog` (presentational): what is deleted in plain words (profile, languages, who you follow and who follows you, your blocks), that it cannot be undone, that you can sign up again with a fresh profile, and a field to **type your handle** (their name if it is not known; capitals and spaces ignored); the danger button stays disabled until it matches, and the dialog cannot be closed while the request runs. The page calls `IdentityService.deleteAccount()`: it leaves the room, `DELETE /api/v1/users/me`, then signs out (Auth0 logout back to the app); on failure it stays signed in and says so in the dialog; if the account is deleted but Auth0's sign-out fails, the person is sent to `/` rather than left in the app with no profile. What happens to their rooms is said in the dialog and done by the services: a room they host goes to the person who has been on its stage the longest (the `ROOM_UPDATED` event then carries `hostId`, and `RoomStore` changes `hostId`, so the new host gets the host controls), or closes if nobody else is on the stage (there is no moderator role yet); they are taken out of every room they are in; the rooms they hosted are erased. The user service cascades the profile, languages, follows and blocks and corrects other people's counts; **the Auth0 identity is not deleted** (that needs the Management API), so signing in again starts a fresh profile.

### The banner and the profile popup

Banner (`layout/shell`, the `<header>` landmark): the brand, the navigation and one account button, on one row at every width (the menubar never collapses, `breakpoint="0px"`,
because a hamburger over a single link hides more than it saves). The account button (the person's picture, or a user icon, with their first name from tablet width up) opens a `p-popover` with who you are and a link to the profile page (`/profile`), then the few preferences nobody needs on every screen: language (`app-locale-switch`), dark theme and right-to-left (`p-toggleswitch`, each with its own `ariaLabel`), and Sign out
when signed in. Add a preference there, not as another icon in the bar. (Source: general guidance to keep a top bar lean and move rarely used settings behind the account, from
mobile-navigation write-ups; none addressed this placement directly.)
Profile: a newcomer is asked for a profile in `profile-dialog` (not dismissable, shown before any page); everyone else manages theirs on the `/profile` page
(`features/profile`): a hero (`profile-hero`: a brand-tinted band, the picture resting on its edge, the name, and the two languages as tags) above one card holding `profile-form`,
the same form the dialog uses. Saving shows a toast, success or failure. No preview card: the hero is the preview once saved. Fields in order: name, picture, what you speak,
what you are learning.

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
