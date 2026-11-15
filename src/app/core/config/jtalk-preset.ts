import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';
import { amber, blue, blueDark, gray, grayDark, green, orange, red, sky } from '@radix-ui/colors';

/**
 * Jtalk design tokens, layered on the Aura preset: a Bauhaus system.
 *
 * Bauhaus, as a UI vocabulary (sources in README "Design system"):
 *  - color: the three primaries (red, yellow, blue) used as flat blocks on black, white and grey;
 *    never gradients, never color alone for state (Kandinsky / Itten, Bauhaus Weimar 1919-25);
 *  - form: the circle, square and triangle, with sharp corners (radius 0) everywhere else;
 *  - flat: no shadows; separation comes from hard rules and borders, not elevation;
 *  - type: a geometric sans (Jost, after the 1920s German geometric faces) for headings, with
 *    Atkinson Hyperlegible kept for running text so unfamiliar words stay unambiguous.
 *
 * Nothing here is invented: every color is a Radix Colors value read from `@radix-ui/colors`. Radix
 * scales have 12 steps with fixed roles (1-2 backgrounds, 3-5 component fills, 6-8 borders, 9-10
 * solid fills, 11-12 text). Optimus scales have 11 slots (50-950), so each `*Ramp` below maps
 * slot -> Radix step.
 */

type Scale = Record<string, string>;
type Ramp = Record<number, number>;

/** `{ blue1 … blue12 }` -> `{ 1 … 12 }`, the shape Optimus references as `{radixBlue.9}`. */
const steps = (scale: Scale): Record<number, string> =>
  Object.fromEntries(Object.values(scale).map((hex, i) => [i + 1, hex]));

/** Slot -> token reference into the primitive `name` (resolved by Optimus per color scheme). */
const refs = (name: string, ramp: Ramp) =>
  Object.fromEntries(Object.entries(ramp).map(([slot, step]) => [slot, `{${name}.${step}}`]));

/** Slot -> literal hex, for palettes Aura reads directly (status colors). */
const hexes = (scale: Scale, ramp: Ramp) =>
  Object.fromEntries(Object.entries(ramp).map(([slot, step]) => [slot, steps(scale)[step]]));

// Dark ramps run the other way: Aura reads a lower slot as lighter on dark backgrounds.
const accentLight: Ramp = {
  50: 2,
  100: 3,
  200: 4,
  300: 5,
  400: 7,
  500: 9,
  600: 10,
  700: 11,
  800: 12,
  900: 12,
  950: 12,
};
const accentDark: Ramp = {
  50: 12,
  100: 12,
  200: 11,
  300: 10,
  400: 9,
  500: 8,
  600: 7,
  700: 6,
  800: 5,
  900: 4,
  950: 3,
};
const neutralLight: Ramp = {
  50: 2,
  100: 3,
  200: 4,
  300: 6,
  400: 7,
  500: 9,
  600: 10,
  700: 11,
  800: 12,
  900: 12,
  950: 12,
};
// Panels sit one step lighter than the page (gray-dark 2 vs 1): separation by lightness, not shadow.
const neutralDark: Ramp = {
  50: 12,
  100: 12,
  200: 12,
  300: 11,
  400: 11,
  500: 9,
  600: 8,
  700: 6,
  800: 4,
  900: 2,
  950: 1,
};
// Aura reads slot 500 for light solids and 400 for dark solids. Radix step 9 is only ~3:1 against
// white text, so 500 -> step 11 (>= 4.5:1) and 400 -> step 9; 600+ -> step 12 for hover/pressed.
const status: Ramp = {
  50: 2,
  100: 3,
  200: 5,
  300: 8,
  400: 9,
  500: 11,
  600: 12,
  700: 12,
  800: 12,
  900: 12,
  950: 12,
};

// Sharp corners. Round shapes are circles on purpose (avatar), never a soft radius.
const borderRadius = { none: '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0' };

// Flat: Bauhaus has no elevation. Overlays are told apart by a hard border (see overlay borders below).
const noShadow = 'none';

// The three Bauhaus primaries as decorative shape fills (Kandinsky's yellow triangle, red square,
// blue circle): Radix step 9, the "solid" step. They carry no state and no text.
const bauhaus = { red: red.red9, yellow: amber.amber9, blue: blue.blue9 };

// Jost (Owen Earl, OFL), inspired by 1920s German geometric sans-serifs: headings, brand, buttons.
// Atkinson Hyperlegible Next (Braille Institute + Applied Design) stays for running text: unambiguous
// letterforms (I / l / 1, 0 / O) for a chat where people read unfamiliar words. Files are self-hosted
// via @fontsource-variable (styles.scss); Noto Sans Arabic is fetched only when Arabic text appears.
const fallbackSans =
  "'Noto Sans Arabic Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const fontFamily = {
  sans: `'Atkinson Hyperlegible Next Variable', ${fallbackSans}`,
  display: `'Jost Variable', ${fallbackSans}`,
  mono: "'Atkinson Hyperlegible Mono Variable', ui-monospace, Menlo, Consolas, monospace",
};

export const JtalkPreset = definePreset(Aura, {
  primitive: {
    radixBlue: steps(blue),
    radixBlueDark: steps(blueDark),
    radixGray: steps(gray),
    radixGrayDark: steps(grayDark),
    // Aura's Tailwind-default status palettes, replaced by Radix. Warnings use Radix amber, the
    // warmer of the two yellows (closer to the Bauhaus cadmium than lemon yellow-9).
    // `purple` (the rarely used "help" severity) stays Aura's: Radix purple-9 under dark text is 3.7:1.
    red: hexes(red, status),
    green: hexes(green, status),
    orange: hexes(orange, status),
    yellow: hexes(amber, status),
    blue: hexes(blue, status),
    sky: hexes(sky, status),
    borderRadius,
  },

  semantic: {
    primary: refs('radixBlue', accentLight),

    // 200ms is inside the 100-250ms range recommended for UI feedback.
    transitionDuration: '0.2s',

    // WCAG 2.4.7 / 2.4.11: a clearly visible, >= 2px, >= 3:1 focus indicator.
    focusRing: { width: '2px', style: 'solid', color: '{primary.color}', offset: '2px' },

    overlay: {
      select: { shadow: noShadow },
      popover: { shadow: noShadow },
      modal: { shadow: noShadow },
      navigation: { shadow: noShadow },
    },

    colorScheme: {
      light: {
        surface: { 0: '#ffffff', ...refs('radixGray', neutralLight) },
        // Solid fill is step 11: white text on blue-11 is 4.8:1 (on step 9 it is 3.3:1).
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.800}',
        },
        // Gray 11 (5.9:1 on white) for muted and placeholder text (>= 4.5:1).
        text: {
          color: '{surface.800}',
          hoverColor: '{surface.800}',
          mutedColor: '{surface.700}',
          hoverMutedColor: '{surface.800}',
        },
        // Field borders are the darkest gray (12): hard black-on-white edges, far above 3:1 (WCAG 1.4.11).
        formField: {
          borderColor: '{surface.800}',
          hoverBorderColor: '{surface.950}',
          placeholderColor: '{surface.700}',
          iconColor: '{surface.700}', // the password show/hide toggle: a control, so >= 3:1
          floatLabelColor: '{surface.700}',
          floatLabelActiveColor: '{surface.700}',
        },
        // Overlays are flat, so a hard border separates them from the page.
        overlay: {
          select: { borderColor: '{surface.800}' },
          popover: { borderColor: '{surface.800}' },
          modal: { borderColor: '{surface.800}' },
        },
      },
      dark: {
        surface: { 0: '#ffffff', ...refs('radixGrayDark', neutralDark) },
        // Dark text on the solid (gray-dark 1 on blue-dark 9 is 5.8:1).
        primary: {
          ...refs('radixBlueDark', accentDark),
          color: '{primary.400}',
          contrastColor: '{surface.950}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
        },
        overlay: {
          select: { borderColor: '{surface.400}' },
          popover: { borderColor: '{surface.400}' },
          modal: { borderColor: '{surface.400}' },
        },
        // Softer than pure white on dark backgrounds (less halation).
        text: { color: '{surface.100}', hoverColor: '{surface.100}' },
        formField: { borderColor: '{surface.400}', hoverBorderColor: '{surface.300}' },
      },
    },
  },

  components: {
    // The breadcrumb sits directly on the page, so it takes no panel of its own.
    breadcrumb: {
      root: { background: 'transparent', padding: '0' },
      // WCAG 2.5.8: the links are pointer targets, so they get the 24 px minimum height.
      css: () => `
        .p-breadcrumb-item-link {
          display: inline-flex;
          align-items: center;
          min-height: 1.5rem;
        }
      `,
    },
    // The header draws its own edge, so the menubar is not a floating panel.
    menubar: {
      root: {
        background: 'transparent',
        borderColor: 'transparent',
        borderRadius: '0',
        padding: '0.75rem 1.5rem',
      },
      // Optimus only adds a class to the current page's link and leaves it unstyled; make it a flat
      // block of the primary color (white text on blue-11 is 4.8:1).
      css: ({ dt }) => `
        .p-menubar {
          flex-wrap: wrap;
          row-gap: 0.5rem;
        }
        .p-menubar-item-link-active {
          background: ${dt('primary.color')};
          color: ${dt('primary.contrast.color')};
          font-weight: 600;
        }
        .p-menubar-item-link-active .p-menubar-item-icon {
          color: inherit;
        }
      `,
    },
    // The navigation progress bar is a thin rule, not a form control.
    progressbar: { root: { height: '0.25rem' } },
    tooltip: {
      root: { borderRadius: '0', shadow: 'none', padding: '0.375rem 0.75rem' },
      colorScheme: {
        light: { root: { background: '{surface.950}', color: '#ffffff' } },
        dark: { root: { background: '{surface.0}', color: '{surface.950}' } },
      },
    },
    // Timelines (the order stages): a flat 4px rule between stages, filled with the primary color up to
    // the stage the order has reached. Markers carry `data-state="done|current|todo"` (see the order page).
    timeline: {
      eventConnector: { size: '4px', color: '{surface.300}' },
      css: ({ dt }) => `
        .p-timeline.p-timeline-horizontal {
          direction: inherit;
        }
        /* Equal columns: Optimus shrinks the last stage to its content, which wraps its text. */
        .p-timeline-horizontal .p-timeline-event:last-child {
          flex: 1;
        }
        .p-timeline-event:has(+ .p-timeline-event [data-state='done']) .p-timeline-event-connector,
        .p-timeline-event:has(+ .p-timeline-event [data-state='current']) .p-timeline-event-connector {
          background: ${dt('primary.color')};
        }
      `,
    },
    // Lists with grouped options (the chat's conversations): date headings in the display face, and the
    // selected option marked by a rule in the primary color as well as by color (not by color alone).
    listbox: {
      css: () => `
        .p-listbox-option-group {
          font-family: var(--p-jtalk-font-display);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .p-listbox-option.p-listbox-option-selected {
          box-shadow: inset 4px 0 0 var(--p-primary-color);
          font-weight: 600;
        }
      `,
    },
    // A circle, the one round form (Kandinsky's blue circle).
    avatar: { root: { borderRadius: '50%' } },
    // Outlined buttons keep a full-strength edge instead of Aura's pale tint (Bauhaus: hard lines), and
    // secondary text takes gray 11 (5.9:1) instead of gray 9 (3.3:1).
    button: {
      root: { label: { fontWeight: '600' } },
      colorScheme: {
        light: {
          outlined: {
            primary: { borderColor: '{primary.color}' },
            secondary: { borderColor: '{surface.800}', color: '{surface.800}' },
            danger: { borderColor: '{red.500}' },
          },
          text: { secondary: { color: '{surface.700}' } },
        },
        dark: {
          outlined: {
            primary: { borderColor: '{primary.color}' },
            secondary: { borderColor: '{surface.400}' },
            danger: { borderColor: '{red.400}' },
          },
        },
      },
    },
    // WCAG 2.5.8 (AA): pointer targets of at least 24x24 CSS px.
    checkbox: { root: { width: '1.5rem', height: '1.5rem' } },
    radiobutton: { root: { width: '1.5rem', height: '1.5rem' } },
  },

  // Exposed as CSS variables (--p-jtalk-font-sans, --p-jtalk-bauhaus-red, ...).
  extend: { jtalk: { font: fontFamily, bauhaus } },

  css: ({ dt }) => `
    :is(
      [data-p-icon='chevron-right'], [data-p-icon='chevron-left'],
      [data-p-icon='angle-right'], [data-p-icon='angle-left'],
      [data-p-icon='angle-double-right'], [data-p-icon='angle-double-left']
    ):dir(rtl) {
      transform: scaleX(-1);
    }

    html {
      font-family: ${dt('jtalk.font.sans')};
      font-optical-sizing: auto;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    h1, h2, h3, h4, h5, h6, .p-button, .p-tag {
      font-family: ${dt('jtalk.font.display')};
    }

    code, kbd, pre, samp {
      font-family: ${dt('jtalk.font.mono')};
    }

    /* Honor the user's reduced-motion preference (WCAG 2.3.3). */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `,
});
