import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';
import { blue, sky } from '@radix-ui/colors';

/**
 * Jtalk design tokens, layered on the Aura preset: "Social Audio", a warm, calm, people-first system
 * in the spirit of Clubhouse.
 *
 *  - color: a warm canvas, off-white cards, near-black ink; Active Green for anything live, Moderator
 *    Gold for roles, Danger for destructive actions. The six brand values are proposals, not an
 *    official palette, and every other step is a mix of them with white or black (see `ramp`);
 *  - form: 8px small controls, 14px buttons, 18px cards, 24px panels, circular avatars;
 *  - elevation: three soft levels (1 cards, 2 floating controls, 3 dialogs and menus), no heavy shadows;
 *  - type: Inter, with hierarchy from size and spacing rather than from many weights;
 *  - state: never color alone (speaking also shows a waveform, muted an icon, roles a labeled badge);
 *  - dark: its own warm theme, not an inverted light one.
 *
 * Contrast is verified numerically: text on solids >= 4.5:1, borders and indicators >= 3:1. That is why
 * the brand green (2.98:1 against white) is the solid only in dark mode, where ink text sits on it
 * (5.8:1); light mode fills buttons with the 700 step (5.5:1 against white).
 */

type Slot = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
type Scale = Record<Slot, string>;

const brand = { green: '#3ba875', gold: '#e8b95b', danger: '#d95d58' };
const ink = '#252525';
const canvas = '#f5f1e8';
const surface = '#fffefa';

const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);

/** `base` mixed `amount` (0-1) of the way towards `to`, as a hex color. */
function mix(base: string, to: string, amount: number): string {
  const part = (at: number) =>
    Math.round(channel(base, at) + (channel(to, at) - channel(base, at)) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

/** An 11-slot Optimus ramp whose 500 is the brand color: tints towards white, shades towards black. */
function ramp(base: string): Scale {
  return {
    50: mix(base, '#ffffff', 0.92),
    100: mix(base, '#ffffff', 0.84),
    200: mix(base, '#ffffff', 0.68),
    300: mix(base, '#ffffff', 0.5),
    400: mix(base, '#ffffff', 0.25),
    500: base,
    600: mix(base, '#000000', 0.15),
    700: mix(base, '#000000', 0.3),
    800: mix(base, '#000000', 0.45),
    900: mix(base, '#000000', 0.58),
    950: mix(base, '#000000', 0.7),
  };
}

const green = ramp(brand.green);
const gold = ramp(brand.gold);
const danger = ramp(brand.danger);

/**
 * A status palette (Aura's severities). Aura reads slot 500 for solids in light mode (white text on
 * it) and slot 400 for solids in dark mode (dark text on it), so those two take the steps that pass
 * 4.5:1; slots 600+ are darker for hover and pressed.
 */
function status(scale: Scale, light: Slot, dark: Slot): Scale {
  return {
    50: scale[50],
    100: scale[100],
    200: scale[200],
    300: scale[300],
    400: scale[dark],
    500: scale[light],
    600: scale[800],
    700: scale[900],
    800: scale[900],
    900: scale[950],
    950: scale[950],
  };
}

/** A Radix scale (12 steps, "blue1" ... "blue12") as an Optimus status palette: 500 -> step 11, 400 -> step 9. */
const radix = (scale: Record<string, string>): Scale => {
  const steps = Object.values(scale);
  const step = (n: number) => steps[n - 1] ?? '';
  return {
    50: step(2),
    100: step(3),
    200: step(5),
    300: step(8),
    400: step(9),
    500: step(11),
    600: step(12),
    700: step(12),
    800: step(12),
    900: step(12),
    950: step(12),
  };
};

// Warm neutrals. Light: 0 card, 50 canvas, 500 the muted tone (borders, icons), 600 muted text, 950 ink.
// Dark runs the other way (a lower slot is lighter): 950 canvas, 900 card, 100 text.
const lightSurface: Record<0 | Slot, string> = {
  0: surface,
  50: canvas,
  100: '#ece7da',
  200: '#ded8c8',
  300: '#cdc7b6',
  400: '#a9a79e',
  500: '#85847e',
  600: '#6b6a64',
  700: '#504f4b',
  800: '#3a3936',
  900: '#2e2d2b',
  950: ink,
};
const darkSurface: Record<0 | Slot, string> = {
  0: surface,
  50: canvas,
  100: '#e8e5db',
  200: '#d2cfc4',
  300: '#b3b0a6',
  400: '#9c9a91',
  500: '#6f6d66',
  600: '#4a4843',
  700: '#3a3935',
  800: '#2e2d29',
  900: '#242320',
  950: '#1b1a18',
};

const radius = { control: '8px', button: '14px', card: '18px', panel: '24px' };

const elevation = {
  light: [
    '0 1px 2px rgba(37, 37, 37, 0.06), 0 1px 1px rgba(37, 37, 37, 0.04)',
    '0 4px 14px rgba(37, 37, 37, 0.1)',
    '0 12px 32px rgba(37, 37, 37, 0.16)',
  ],
  dark: [
    '0 1px 2px rgba(0, 0, 0, 0.35)',
    '0 4px 14px rgba(0, 0, 0, 0.45)',
    '0 12px 32px rgba(0, 0, 0, 0.55)',
  ],
};

// Inter has no Arabic glyphs, so Arabic text falls through to Noto Sans Arabic (fetched only when it appears).
const fontFamily = {
  sans: "'Inter Variable', 'Noto Sans Arabic Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

// Type scale: size by role, weight 400/500/600/700 only.
const type = {
  display: '2rem',
  h1: '1.625rem',
  h2: '1.25rem',
  h3: '1rem',
  body: '0.9375rem',
  secondary: '0.8125rem',
  caption: '0.6875rem',
};

// Fills for initials avatars and room banners: the brand colors at depths that carry text (white on
// green and coral >= 4.9:1, ink on gold 8.4:1), and fine on both canvases.
const tone = { green: green[700], gold: gold[500], coral: danger[600] };

export const JtalkPreset = definePreset(Aura, {
  primitive: {
    // Aura's Tailwind-default palettes, replaced. Warnings and the other warm severities are gold.
    // `purple` (the rarely used "help" severity) stays Aura's.
    green: status(green, 700, 500),
    red: status(danger, 600, 400),
    yellow: status(gold, 800, 500),
    orange: status(gold, 800, 500),
    // Information keeps Radix blue and sky (white on blue-11 is 4.8:1): the brand has no blue.
    blue: radix(blue),
    sky: radix(sky),
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: radius.control,
      md: '10px',
      lg: '14px',
      xl: radius.card,
    },
  },

  semantic: {
    primary: green,

    transitionDuration: '0.2s',

    // WCAG 2.4.7 / 2.4.11: a clearly visible, >= 2px, >= 3:1 focus indicator.
    focusRing: { width: '2px', style: 'solid', color: '{primary.color}', offset: '2px' },

    formField: { borderRadius: radius.control },
    content: { borderRadius: radius.control },

    overlay: {
      select: { borderRadius: radius.button, shadow: 'var(--p-jtalk-elevation-3)' },
      popover: { borderRadius: radius.button, shadow: 'var(--p-jtalk-elevation-3)' },
      modal: { borderRadius: radius.panel, shadow: 'var(--p-jtalk-elevation-3)' },
      navigation: { shadow: 'var(--p-jtalk-elevation-3)' },
    },

    colorScheme: {
      light: {
        surface: lightSurface,
        // The 700 step under white text: 5.5:1.
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.900}',
        },
        text: {
          color: '{surface.950}',
          hoverColor: '{surface.950}',
          mutedColor: '{surface.600}',
          hoverMutedColor: '{surface.700}',
        },
        // Field borders are the muted tone (3.3:1 on the canvas, 3.7:1 on a card): WCAG 1.4.11.
        formField: {
          background: '{surface.0}',
          borderColor: '{surface.500}',
          hoverBorderColor: '{surface.600}',
          placeholderColor: '{surface.600}',
          iconColor: '{surface.600}',
          floatLabelColor: '{surface.600}',
          floatLabelActiveColor: '{surface.600}',
        },
        overlay: {
          select: { borderColor: '{surface.200}' },
          popover: { borderColor: '{surface.200}' },
          modal: { borderColor: '{surface.200}' },
        },
        mask: { background: 'rgba(37, 37, 37, 0.45)' },
      },
      dark: {
        surface: darkSurface,
        // The brand green itself, with near-black text on it: 5.8:1.
        primary: {
          color: '{primary.500}',
          contrastColor: '{surface.950}',
          hoverColor: '{primary.400}',
          activeColor: '{primary.300}',
        },
        text: {
          color: '{surface.100}',
          hoverColor: '{surface.50}',
          mutedColor: '{surface.400}',
          hoverMutedColor: '{surface.300}',
        },
        formField: {
          background: '{surface.900}',
          borderColor: '{surface.500}',
          hoverBorderColor: '{surface.400}',
          placeholderColor: '{surface.400}',
          iconColor: '{surface.400}',
          floatLabelColor: '{surface.400}',
          floatLabelActiveColor: '{surface.400}',
        },
        content: { borderColor: '{surface.700}', hoverBackground: '{surface.800}' },
        overlay: {
          select: { borderColor: '{surface.700}' },
          popover: { borderColor: '{surface.700}' },
          modal: { borderColor: '{surface.700}' },
        },
        mask: { background: 'rgba(0, 0, 0, 0.6)' },
      },
    },
  },

  components: {
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
    menubar: {
      root: {
        background: 'transparent',
        borderColor: 'transparent',
        borderRadius: '0',
        padding: '0.75rem 1.5rem',
      },
      // Optimus only adds a class to the current page's link: tint it and set it in a heavier weight.
      css: ({ dt }) => `
        .p-menubar {
          flex-wrap: wrap;
          row-gap: 0.5rem;
        }
        .p-menubar-item-link-active {
          background: color-mix(in srgb, ${dt('primary.color')} 14%, transparent);
          color: ${dt('text.color')};
          font-weight: 600;
        }
        .p-menubar-item-link-active .p-menubar-item-icon {
          color: ${dt('primary.color')};
        }
      `,
    },
    progressbar: { root: { height: '0.25rem' } },
    tooltip: {
      root: {
        borderRadius: radius.control,
        shadow: 'var(--p-jtalk-elevation-2)',
        padding: '0.375rem 0.75rem',
      },
      colorScheme: {
        light: { root: { background: '{surface.950}', color: surface } },
        dark: { root: { background: '{surface.100}', color: '{surface.950}' } },
      },
    },
    timeline: {
      eventConnector: { size: '4px', color: '{surface.200}' },
      css: ({ dt }) => `
        .p-timeline.p-timeline-horizontal {
          direction: inherit;
        }
        .p-timeline-horizontal .p-timeline-event:last-child {
          flex: 1;
        }
        .p-timeline-event:has(+ .p-timeline-event [data-state='done']) .p-timeline-event-connector,
        .p-timeline-event:has(+ .p-timeline-event [data-state='current']) .p-timeline-event-connector {
          background: ${dt('primary.color')};
        }
      `,
    },
    listbox: {
      css: () => `
        .p-listbox-option-group {
          font-size: var(--p-jtalk-type-caption);
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .p-listbox-option.p-listbox-option-selected {
          box-shadow: inset 3px 0 0 var(--p-primary-color);
          font-weight: 600;
        }
      `,
    },
    card: {
      root: { borderRadius: radius.card, shadow: 'var(--p-jtalk-elevation-1)' },
      body: { padding: '1rem', gap: '0.5rem' },
      title: { fontSize: type.h3, fontWeight: '600' },
      css: ({ dt }) => `
        .p-card {
          border: 1px solid ${dt('content.border.color')};
          overflow: hidden;
        }
      `,
    },
    // Sizes of the avatar scale: 36 (normal), 48 (large), 88 (xlarge); 28 and 64 are set by the component.
    avatar: {
      root: { width: '2.25rem', height: '2.25rem', fontSize: '0.875rem', borderRadius: '50%' },
      lg: { width: '3rem', height: '3rem', fontSize: '1.125rem' },
      xl: { width: '5.5rem', height: '5.5rem', fontSize: '1.75rem' },
    },
    // Badges: small, labeled, pill-shaped; role colors (gold for moderators) come from the severities.
    tag: {
      root: {
        fontSize: type.caption,
        fontWeight: '500',
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
      },
    },
    toast: { root: { borderRadius: radius.button } },
    message: { root: { borderRadius: radius.button } },
    button: {
      root: {
        borderRadius: radius.button,
        label: { fontWeight: '600' },
        paddingY: '0.625rem',
        paddingX: '1rem',
      },
      colorScheme: {
        light: {
          outlined: {
            primary: { borderColor: '{primary.color}' },
            secondary: { borderColor: '{surface.500}', color: '{surface.800}' },
            danger: { borderColor: '{red.500}' },
          },
          text: { secondary: { color: '{surface.600}' } },
        },
        dark: {
          outlined: {
            primary: { borderColor: '{primary.color}' },
            secondary: { borderColor: '{surface.500}' },
            danger: { borderColor: '{red.400}' },
          },
        },
      },
    },
    // WCAG 2.5.8 (AA): pointer targets of at least 24x24 CSS px.
    checkbox: { root: { width: '1.5rem', height: '1.5rem' } },
    radiobutton: { root: { width: '1.5rem', height: '1.5rem' } },
  },

  // Exposed as CSS variables (--p-jtalk-font-sans, --p-jtalk-brand, --p-jtalk-type-h1, ...).
  extend: {
    jtalk: {
      font: fontFamily,
      type,
      tone,
      brand: brand.green,
      moderator: brand.gold,
      danger: brand.danger,
      radius,
    },
  },

  css: ({ dt }) => `
    :root {
      --p-jtalk-elevation-1: ${elevation.light[0]};
      --p-jtalk-elevation-2: ${elevation.light[1]};
      --p-jtalk-elevation-3: ${elevation.light[2]};
    }

    .app-dark {
      --p-jtalk-elevation-1: ${elevation.dark[0]};
      --p-jtalk-elevation-2: ${elevation.dark[1]};
      --p-jtalk-elevation-3: ${elevation.dark[2]};
    }

    :is(
      [data-p-icon='chevron-right'], [data-p-icon='chevron-left'],
      [data-p-icon='angle-right'], [data-p-icon='angle-left'],
      [data-p-icon='angle-double-right'], [data-p-icon='angle-double-left']
    ):dir(rtl) {
      transform: scaleX(-1);
    }

    html {
      font-family: ${dt('jtalk.font.sans')};
      font-size: 100%;
      font-optical-sizing: auto;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    body {
      font-size: ${dt('jtalk.type.body')};
      line-height: 1.5;
    }

    h1 { font-size: ${dt('jtalk.type.h1')}; font-weight: 700; line-height: 1.2; }
    h2 { font-size: ${dt('jtalk.type.h2')}; font-weight: 600; line-height: 1.3; }
    h3 { font-size: ${dt('jtalk.type.h3')}; font-weight: 600; line-height: 1.4; }

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
