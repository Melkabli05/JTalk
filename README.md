# Jtalk: live communication frontend

The web client for the `live-communication-service` backend (voice rooms, stage, hand raising). It starts from an empty
Angular 22 skeleton: zoneless, signals, Signal Forms, lazy feature routes, functional guards and interceptors,
[Optimus UI](https://optimus.openng.org) with a custom theme, Vitest, Arabic first (English too). What the skeleton keeps is
the structure and its enforced rules (`CLAUDE.md`), the application shell, the account pages (`core/auth`), the theme,
the i18n setup and a mock API. `features/home` is a one-page placeholder for the first real page.

**Talking to the backend.** `pnpm start` proxies `/api` to http://localhost:8080 (`proxy.conf.json`), where
`live-communication-service` listens. With the backend's security switched off (`MICRONAUT_SECURITY_ENABLED=false`) there is no sign-in: before
using the app the person fills in a **profile** (a name, one of ten bundled pictures from `public/avatars/`, the language they speak and the one they are learning) in a dialog. It is kept in
this browser and its generated id is sent as `X-User-Id`. Other people are shown by the start of their id until a user service names them. That is a stand-in for the user service that will replace it: it lives in `IdentityService` (`core/auth`) and is active only
where `devIdentity` is on. With the backend's default configuration every call needs `Authorization: Bearer <JWT>` whose `sub` is the user's UUID,
which `authInterceptor` sends.

**Rooms** (`features/rooms`) are the product so far:

- **The hallway** lists the open rooms as cards (a colored language banner, the title, who is on stage, how busy it is), filters them by language,
  and starts a room from a dialog that is filled in for the person (a title and topic, the language they are learning to practise, theirs for the audience).
- **A room** shows the stage with its open seats, the raised hands in order, and the audience. Anyone can take a free seat or raise a hand; the host invites,
  moves, removes, edits and ends. The page says "still here" and refreshes every 3 seconds, and sends the person back to the hallway when the host removes
  them or the room ends.
- Built from Optimus components (card, avatar, avatar group, tag, badge, dialog, select, selectbutton, skeleton, message, confirm dialog); the only custom
  pieces are the Signal Forms wrappers and the tiles.
- **Accessible**: real heading structure, every control named (the Join button names its room, a seat is "Take free seat 3 of 4"), decorative avatars and
  flags hidden from screen readers, changes announced politely through the CDK `LiveAnnouncer` ("Maya joined the stage", "You raised your hand"),
  focus moved to the room title on arrival, a sticky controls bar with large targets, status in words and not only dimming, and logical CSS so Arabic
  right-to-left works.
- **Audio** (LiveKit): entering a room connects to its audio with the address and token the backend returns in the session. A
  speaker's microphone opens by itself (Mute/Unmute in the controls), listeners hear the stage, and the stage shows a ring around whoever is
  speaking. The server grants and takes away the right to speak while connected, so no token refresh is needed, and it pushes room events
  (seats, hands) so the screen updates at once instead of waiting for the 3 s refresh. If the browser blocks sound a "Turn on sound" button
  appears; if the connection is lost, "Reconnect audio". `livekit-client` is loaded only when a room opens (its own lazy chunk).

There is no mock data for rooms: the hallway shows what the backend has, which is nothing until someone opens a room.

## Getting started

```bash
pnpm install
pnpm start        # http://localhost:4200 (/api is proxied to http://localhost:8080)
```

| Script            | What it does                                               |
| ----------------- | ---------------------------------------------------------- |
| `pnpm start`      | Dev server (development environment + API proxy)           |
| `pnpm start:mock` | Dev server plus the in-memory mock API (no backend needed) |
| `pnpm mock`       | The mock API alone, on http://localhost:3030/api           |
| `pnpm build`      | Production build into `dist/`                              |
| `pnpm test`       | Unit tests (Vitest), watch mode; `pnpm test:ci` runs once  |
| `pnpm lint`       | ESLint: Angular rules, template accessibility, boundaries  |
| `pnpm format`     | Prettier (`format:check` verifies)                         |
| `pnpm check`      | lint + format check + tests + build                        |

Requires Node `^22.22.3 || ^24.15.0` and pnpm.

### Mock API

A stand-in backend, in memory, so the app runs without one (`pnpm start:mock`, or `pnpm mock` alone on port 3030). For now it
has only the account endpoints the skeleton's pages use: sign in (any password but `wrong` gives 401; five failures lock an
address out with 429), register and forgot-password (always 202, so they leak nothing), and reset-password (refuses the token
`expired`). Add a file under `mock/routes/` for each area the app needs.

Every request takes 300-450 ms so loading states show, and one line of log per request (`MOCK_LOG=0` silences it).
Settings: `MOCK_PORT`, `MOCK_LATENCY`, `MOCK_SCENARIO`, `MOCK_LOG`.

Scenarios make it misbehave, to see the states a real backend produces. Start in one (`MOCK_SCENARIO=errors pnpm start:mock`) or
switch while it runs. A scenario fails a request before the router runs, so it applies to any data path:

| Scenario          | What happens                                                  |
| ----------------- | ------------------------------------------------------------- |
| `default`         | everything works                                              |
| `slow`            | responses take 2-3 seconds                                    |
| `flaky`           | 20% of data requests fail with 500 and 5% drop the connection |
| `errors`          | every data request fails with 500                             |
| `auth-required`   | data requests need an `Authorization: Bearer` token, else 401 |
| `session-expired` | data requests always answer 401, even with a token            |

```bash
curl localhost:3030/__mock                                            # scenarios, current one, counts
curl -X POST localhost:3030/__mock/scenario -d '{"name":"errors"}'   # switch
curl -X POST localhost:3030/__mock/reset                              # back to the start
```

Sign-in and the `/__mock` controls are never failed by the scenarios. `pnpm start:mock` serves the app against it through
`mock/proxy.conf.json`; extra arguments go to `ng serve` (`pnpm start:mock --port 4300`).

The mock is organised like a small app: `server.mjs` is the request pipeline (CORS, latency, scenarios, routing), `router.mjs` a
10-line route matcher, `routes/` one file per area, `state.mjs` the data and its reset, `scenarios.mjs` the failures. Its own tests
(`pnpm mock:test`, Node's built-in runner) keep it honest. The Angular unit tests do not use the mock: they use `HttpTestingController`.

## Structure

```
src/
  main.ts  index.html
  styles/            styles.scss (global, fonts) and _tokens.scss (layout scale for component styles)
  environments/      environment.ts (production), environment.development.ts
  app/
    app.ts  app.html  app.scss  app.config.ts  app.routes.ts
    core/            app-wide infrastructure (@core/*)
      auth/            auth.service, auth.guard, auth.models
      http/            api-base-url.token, auth.interceptor
      error-handling/  http-error.interceptor, global-error-handler, pages/not-found-page/
      config/          app-config, jtalk-preset (design tokens), color-scheme.service, page-title.strategy
    layout/          the application shell
      layout.routes.ts   wraps routes in the shell: layoutRoutes(children)
      shell/             container: auth, theme, router; its header with the navigation (p-menubar) and
                         breadcrumb (p-breadcrumb) are Optimus components
    shared/          reusable across features, business-agnostic (@shared/*)
      ui/                text-field/ (a thin Signal Forms control; see Optimus first)
      pipes/  directives/ (aria-current, trim-on-blur)  utils/ (safe-storage, form-submission, as-record)
    features/        one folder per business area, lazy-loaded
      <feature>/
        pages/<x>-page/     route-level containers
        ui/<component>/     presentational components
        data-access/        <feature>-api.service, parsers/ (check what the API sends)
        state/              <x>.store (the feature's state as signals) and <x>.facade (what a page injects: the state,
                            the use cases, what keeps the feature alive); only when a feature has state worth it, e.g. rooms
        models/             <x>.model (what the app uses), <x>.dto (what the API sends)
        <feature>.routes.ts routes, loaded with loadChildren at the feature boundary
        <feature>.ts        public API: the only file other code imports
```

File names follow the `.component.ts` / `.service.ts` / `.guard.ts` / `.interceptor.ts` / `.pipe.ts` /
`.directive.ts` convention, with specs beside the code. `angular.json` configures the CLI schematics to
generate exactly these names (`ng generate @schematics/angular:service ...`).

### Dependency rules (enforced by `pnpm lint`)

| Folder      | May import                          |
| ----------- | ----------------------------------- |
| `features/` | `core/`, `shared/`, and itself only |
| `layout/`   | `core/`, `shared/`                  |
| `core/`     | `shared/`                           |
| `shared/`   | nothing from the app                |

Features never import each other, and only `app.routes.ts` wires `layout/` and `features/` together. Use the
`@core/*` and `@shared/*` aliases across folders, and relative paths inside one feature.

### Smart and dumb components

**Services, the router and data loading live only in containers, in every feature.** A container ("smart") is
exactly one file: a routed page's `<x>-page.component.ts` (under `pages/<x>-page/`) or `layout/shell/app-shell.component.ts`.
Every other component is presentational ("dumb"), wherever it lives: a feature's `ui/`, a page's own `ui/`,
`layout/navigation`, `shared/ui`. Being inside a `pages/` folder is not enough.

|                  | Container ("smart")                                | Presentational ("dumb")                       |
| ---------------- | -------------------------------------------------- | --------------------------------------------- |
| Lives in         | `<x>-page.component.ts` in `pages/`, and the shell | any other component (`ui/`, `shared/ui`, ...) |
| Injects services | yes: data-access, `AuthService`, `Router` ...      | **never**                                     |
| Loads data       | starts the resources, owns loading and errors      | receives plain values through `input()`       |
| Router           | reads it, navigates, uses `RouterLink`             | **none**, not even `RouterLink`               |
| Navigation       | `routerLink`, `router.navigate`                    | emits an `output()`; the container navigates  |
| Reports back     | calls services, navigates, handles failures        | `output()` only                               |
| Tested with      | real service + `HttpTestingController`             | inputs and outputs, no providers              |

`pnpm lint` enforces this for every `*.component.ts` except those two kinds of file, so it covers features that don't
exist yet. A presentational component cannot: call `inject()`; take constructor parameters; declare `providers`; import `Injectable`, `Service`, `Injector` or `resource`; import `rxResource` or
`toSignal`; import anything from `@angular/common/http` or (as a value) from `@angular/router`; import a
`*.service`, `*.store` or `*.facade` file, or anything under `data-access/` or `state/`; or import a value from `@core/*` (types are fine). The fix is always the same:
take the data as an `input()` and emit an `output()`, or move the component to a container.

**Navigation from a presentational component.** It emits an `output()` (`selected`, `cancelled`, ...) and the container
decides where to go and calls the router. A link in a container's template (`routerLink`) is fine, including links it
projects into an Optimus component such as the table's empty message.

Example: a `*-page` container loads the data, saves it and navigates; a presentational form component owns the fields
and validation, shows what `submitting` and `error` say, and emits `save`. Output names must not collide with DOM events
(`select`, `cancel`): lint rejects them.

### Where does new code go?

- A new business area → `features/<name>/` with only the folders it needs, plus `<name>.routes.ts` and `<name>.ts`,
  registered in `app.routes.ts` with `loadChildren: () => import('./features/<name>/<name>').then(m => m.<NAME>_ROUTES)`.
- A screen that coordinates data → `pages/<x>-page/`. A piece of UI → `ui/<x>/` (one feature) or `shared/ui/<x>/` (several).
- An API client → `data-access/`; keep wire formats there and check them with a parser that returns the `models/` type.
- An interceptor, guard, token or app-wide service → `core/`. A generic helper → `shared/utils/`.
- A route that needs a breadcrumb → `data: { breadcrumb: 'Label' }` on that route.

## Data, HTTP and services

- Services use `@Service()` and `inject()`. `@Injectable()` is only for classes registered with `useClass`
  (`GlobalErrorHandler`, `PageTitleStrategy`), which `@Service` does not support.
- **Reads are `httpResource`s**, created by the data-access service and used by a page as signals:
  `usersResource()` / `userResource(() => id())`. They come with `isLoading`, `error`, `hasValue`, `value` and
  `reload()`, cancel an in-flight request when their inputs change, and go through the interceptors. Call the
  factory from a field initializer (it needs an injection context).
- **Guard reads with `hasValue()`**: `value()` throws while the resource is in the error state. Templates check
  `hasValue()` first, then `error()`, and fall back to a spinner (`loading` and `idle`).
- **Validate what the API sends**: every resource passes a `parse` function (`parseRooms`, `parseRoom`, ...) from
  the feature's parser, which checks the shape and returns the model. A response of the wrong shape becomes
  an error state instead of bad data. No schema library is needed for this; add Zod if the shapes grow.
- **Writes are `HttpClient` Observables**, not resources (a resource would cancel or re-run them as signals change;
  the Angular docs say to avoid `httpResource` for mutations): `api.update(...).pipe(finalize(...)).subscribe({ next, error })`.
  There is no `firstValueFrom`, and Angular has no mutation helper to replace it. Data-access Observables are cold:
  nothing is sent until someone subscribes.
- `rxResource` is for non-HTTP Observables (a WebSocket, a stream).
- `API_BASE_URL` (`core/http`) is the one place the backend URL comes from. `authInterceptor` adds the bearer token only
  to requests under that URL. `httpErrorInterceptor` ends the session on a 401 while signed in; every error still
  reaches the caller.
- Tests of containers use the real data-access service with `HttpTestingController`, so they assert the actual
  requests and responses instead of hand-made fakes.

> **Placeholders to align with the real backend:** `POST /auth/login -> { token }` and the other `/auth/*` endpoints. The
> token is kept in `sessionStorage`; an httpOnly cookie set by the backend is safer against XSS. `authGuard` redirects
> to `/login` (the account pages in `core/auth`) and is not applied to any route: protect routes with
> `canActivate: [authGuard]` when you need it. Guards are a UX convenience, not security: the API must enforce authorization.

## Optimus first (standing rule)

**Always prefer an Optimus builtin over building our own.** Check the [Optimus component index](https://optimus.openng.org/llms/llms.txt)
before writing any UI; only build when nothing fits, and say why. Used today:

| Need                    | Optimus builtin                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Header and navigation   | `p-menubar` (`#start` brand, `#end` actions) inside `<nav aria-label="Primary">`, a menu button on phones |
| Breadcrumb trail        | `p-breadcrumb` (items from route `data.breadcrumb`)                                                       |
| Lists of records        | `p-table` (header, body, `#emptymessage`; links in cells)                                                 |
| Paging, sorting, search | `p-table` built-ins: `[paginator]`, `pSortableColumn`, `filterGlobal` with `p-iconfield`                  |
| Buttons                 | the `pButton` directive on a native `<button>`; **`<a pButton routerLink>` for link buttons**             |
| Status labels           | `p-tag`                                                                                                   |
| Errors and alerts       | `p-message` (`role="alert"`; `variant="simple"` for field errors)                                         |
| Success feedback        | `MessageService.add` + one `<p-toast />` in `app.html` (saved, deleted)                                   |
| Pictures                | `p-avatar` (+ `p-avatar-group` for stacks), `p-image` with `[preview]` for click-to-enlarge               |
| Loading                 | `p-progress-spinner` (with `ariaLabel`)                                                                   |
| Confirmation            | `ConfirmationService` + `<p-confirmdialog />`, owned by the page                                          |
| User initials           | `p-avatar`                                                                                                |
| Text input              | `pInputText`                                                                                              |

Use the **`pButton` directive, not the `<p-button>` component**: the component adds a native `autofocus` attribute in
Optimus 2.0.2 (the browser focuses the first button on load), and the directive does not.

What we still build, and why:

- **text-field**: a Signal Forms control. `[formField]` pushes the raw `invalid` state into `pInputText`, which would flag
  untouched fields; this component shows `invalid`, `touched` and `errors` only after interaction (errors render as `p-message`).
- **appAriaCurrent** directive and a few preset lines: `p-menubar` adds a class to the current link but styles nothing and sets no
  `aria-current`, so the preset styles `.p-menubar-item-link-active` and the directive sets `aria-current="page"` (using the
  router's `isActive`). Delete both if Optimus fixes it. Also **trim-on-blur**, the **initials** pipe (Avatar needs the text)
  and the `formSubmission` / `asRecord` helpers, none of which Optimus has an equivalent for.

Known trade-off, accepted: `p-menubar` renders `role="menu"`, an application-menu pattern; site navigation is normally a `nav` with
links ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role)). The shell keeps a real `nav`
landmark around it to limit the damage.

## Theme: Bauhaus

`core/config/jtalk-preset.ts` extends Optimus' Aura preset (`definePreset`; primitive -> semantic -> component tokens, see the
[styled-mode guide](https://optimus.openng.org/theming/styled)) as a Bauhaus system:

- **Color**: the three primaries as flat blocks on black, white and grey, no gradients. Primary is Radix `blue`, neutrals are Radix
  `gray` (no tint), danger is Radix `red`, warnings Radix `amber`. Every value is read from
  [`@radix-ui/colors`](https://www.radix-ui.com/colors); none is invented.
- **Form**: radius `0` everywhere; the one round shape is the avatar (a circle). The brand mark is Kandinsky's trio, a yellow
  triangle, red square and blue circle
  ([his 1923 Bauhaus questionnaire](https://aesthetics.univie.ac.at/publications/details/pure/9eb8aa6b-a8e2-4ea1-9b25-610f2f518d07/show/publ/Pure)),
  built from CSS in the shell and filled from `--p-jtalk-bauhaus-*` tokens.
- **Flat**: no shadows. Overlays, inputs and outlined buttons get hard dark borders; the header has a 4px rule.
- **Type**: [Jost](https://fontsource.org/fonts/jost) (OFL, inspired by 1920s German geometric sans-serifs, in the spirit of Bayer's
  [Universal alphabet](https://letterformarchive.org/news/bauhaus-typefaces-part-two/)) for headings, buttons, tags and the brand;
  Atkinson Hyperlegible Next/Mono for running text and code, self-hosted.
- **Accessibility is not traded away**: primary solids >= 4.5:1 with white text (blue-11 4.8:1), field borders far above 3:1, 24px
  targets, 2px focus ring, reduced motion respected. Color never carries state alone.

Dark mode toggles the `app-dark` class on `<html>` (`ColorSchemeService`); `index.html` applies it before first paint.
Read the [Optimus docs](https://optimus.openng.org/llms/llms.txt) before using a component.

## Deploying (Vercel)

The app is a static build (`pnpm build`, output `dist/Jtalk/browser`), and `vercel.json` is its routing ([Vercel: rewrites](https://vercel.com/docs/rewrites)):

- `/api/*` is **proxied** to the backend on Render (`https://live-communication-service.onrender.com`). The browser only ever calls the
  app's own domain, so there is no CORS and `environment.ts` can keep `apiUrl: '/api'`. Change the backend's address in `vercel.json`, nowhere else.
- Every other path falls back to `index.html`, so deep links such as `/rooms/<id>` load (real files are still served first).
- Proxied answers are never cached on the CDN (`x-vercel-enable-rewrite-caching: 0`): rooms and the stage change every few seconds.

The backend on Render sleeps when idle on the free plan, so the first request after a quiet period can be slow or fail; the app refreshes every few
seconds and recovers by itself. While the backend runs in its open testing mode (`MICRONAUT_SECURITY_ENABLED=false`) the production build uses the dev
identity (`devIdentity: true` in `environment.ts`); turn that off when a user service issues tokens.

## Quality gates

`pnpm check` runs ESLint with **type-aware rules** (including `no-deprecated`), Prettier, the tests and the build. The
compiler treats all 17 Angular **extended diagnostics as errors** (unused imports, needless `?.`, uninvoked signals, ...),
and app code compiles with `noUncheckedIndexedAccess`. TypeScript stays on 6.0: Angular requires `>=6.0 <6.1`.

## Notes

- The initial-bundle warning is 800 kB raw (about 165 kB transferred): the Aura tokens and the Optimus shell components are bundled.
- Not included: SSR (`ng add @angular/ssr`), more languages than English and Arabic (see Languages).

## Languages (i18n)

English and Arabic, switched at run time with an Optimus `p-selectbutton` in the header (and on the account pages, which have no
header). The choice is kept in `localStorage`, `<html lang>` follows it, and Arabic also turns the page right-to-left (see below).

- **Text** is looked up by its English wording: `{{ 'Sign in' | t }}`, `'Use at least {minLength} characters.' | t: { minLength }`, or `I18n.t(...)`
  in a container. English is the source, so a text without a translation shows the English. `{name}` marks a value, taken from
  the object after the colon (a validation error carries its own: `{minLength}`). The Arabic catalog is
  `shared/utils/i18n/ar/messages.ts`, loaded only when Arabic is chosen. Text kept in a constant or a route (`title`,
  `breadcrumb`, a `failure:` message) is wrapped in `msg('...')`, which returns it unchanged but lets `pnpm i18n:check` (part
  of `pnpm check`) find it: it fails for a text with no Arabic and for an Arabic entry nothing uses.
- **Optimus components** (paginator, filters, date picker, aria labels) get `shared/utils/i18n/ar/optimus.ts` through
  `Optimus.setTranslation`, as the [configuration guide](https://optimus.openng.org/configuration) describes. The
  `@openng/optimus-ui-locale` package has no Arabic, so the whole `Translation` object is here.
- **Dates and money** use the Angular locale: pass `locale()` to the built-in pipes
  (`date: 'mediumDate' : undefined : locale()`). Its data is loaded together with the Arabic catalog.
- **Adding a language**: an entry in `locales.ts`, a loader in `i18n.service.ts`, and a folder like `ar/` with its catalog and
  its Optimus `Translation`.

## Right-to-left

The header's arrows button switches the page between left-to-right and right-to-left. `DirectionService` (`core/config`) sets
`<html dir>`, remembers the choice in `localStorage`, and a one-line script in `index.html` applies it before the first paint. The
direction is independent of `lang` (switching to Arabic sets it, and the button can flip it back). Optimus follows `dir` by itself ([guide](https://optimus.openng.org/guides/rtl)); Galleria and
Carousel are not supported there (not used here).

- Use CSS logical properties (`margin-inline`, `padding-block`, `inset-inline`, `inline-size`), never `left`/`right`.
- Text typed by users or written by the model gets `dir="auto"`; emails, phone numbers and codes get `<bdi>` or `dir="ltr"`.
- Arrows and chevrons are mirrored by `:dir(rtl)` rules (the preset's `css` hook, and `styles.scss` for `pi-*` icons).
- The CDK `Directionality` does not notice a runtime change of `<html dir>`, so the app does not use it.
- English text in a right-to-left page keeps its punctuation on the wrong side: switch the language too.
