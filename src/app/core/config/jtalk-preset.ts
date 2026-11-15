import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';

/**
 * Jtalk design tokens, layered on the Aura preset: Gather UI 2.0, "contemporary social audio x editorial
 * minimalism x human warmth".
 *
 *  - color: porcelain canvas, paper surfaces, Forest Ink text. Forest green is strategic: it marks what is
 *    active (live, speaking, the primary action), never decoration. Sand (gold in dark) marks elevated room
 *    permissions, Terracotta marks danger. One color, one meaning, in both themes. The values are the design
 *    proposal's; the steps between them are mixes of those values with white or black (see `ramp`);
 *  - shape hierarchy: 10px small controls, 12px fields, 16px cards, 22px feature panels, 26px sheets, 14px
 *    buttons (pills in the control dock), circular avatars;
 *  - surface: tonal contrast and hairline borders, shadows almost invisible;
 *  - type: Manrope, hierarchy from size and weight (400-700), no uppercase for ordinary text;
 *  - motion: 120ms for button feedback, 180ms small transitions, 280ms sheets and overlays;
 *  - state: never color alone (speaking also shows a waveform, muted an icon, roles a labeled badge);
 *  - targets: at least 44x44px for buttons and fields.
 *
 * Contrast is verified numerically: text on fills >= 4.5:1, borders and indicators >= 3:1. Where the proposal's
 * value falls short, the nearest passing one is used: secondary text `#6A6C64` (the proposed `#777970` is
 * 4.05:1 on porcelain), the filled danger `#B0574E` (Terracotta `#C9685E` is 3.7:1 under white), and field
 * borders `#8F9187` (the hairline `#E8E6DE` is for cards only). Tertiary `#999B91` is 2.8:1, so it is never
 * used for text.
 */

type Slot = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
type Scale = Record<Slot, string>;

const forest = '#477a5d';
const sage = '#80b18d';
const sand = '#dcc79e';
const gold = '#c9af7e';
const terracotta = '#c9685e';
const coral = '#df8277';
const infoBlue = '#6389b5';
const ink = '#20251f';

const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);

/** `base` mixed `amount` (0-1) of the way towards `to`, as a hex color. */
function mix(base: string, to: string, amount: number): string {
  const part = (at: number) =>
    Math.round(channel(base, at) + (channel(to, at) - channel(base, at)) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

/** An 11-slot Optimus ramp whose 500 is the given color: tints towards white, shades towards black. */
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

/**
 * A status palette (Aura's severities). Aura reads slot 500 for solids in light mode (white text on it)
 * and slot 400 for solids in dark mode (dark text on it), so those two take the given colors, chosen to
 * pass 4.5:1; slots 600+ are darker for hover and pressed, 50-300 are tints.
 */
function status(tints: string, light: string, dark: string): Scale {
  const tint = ramp(tints);
  return {
    50: tint[50],
    100: tint[100],
    200: tint[200],
    300: tint[300],
    400: dark,
    500: light,
    600: mix(light, '#000000', 0.2),
    700: mix(light, '#000000', 0.4),
    800: mix(light, '#000000', 0.55),
    900: mix(light, '#000000', 0.7),
    950: mix(light, '#000000', 0.8),
  };
}

// Tonal surfaces. Light: 0 paper, 50 porcelain, 100 the secondary surface, 200 the hairline border, 500 the
// field border (3.2:1), 600 secondary text, 950 Forest Ink. Dark runs the other way (a lower slot is lighter):
// 950 night, 900 surface, 800 secondary surface, 700 hairline border, 500 field border, 300 secondary text.
const lightSurface: Record<0 | Slot, string> = {
  0: '#ffffff',
  50: '#f7f5ef',
  100: '#efeee7',
  200: '#e8e6de',
  300: '#d6d4ca',
  400: '#b3b5ab',
  500: '#8f9187',
  600: '#6a6c64',
  700: '#505249',
  800: '#3a3e37',
  900: '#2a2f29',
  950: ink,
};
const darkSurface: Record<0 | Slot, string> = {
  0: '#ffffff',
  50: '#f7f5ef',
  100: '#edeee7',
  200: '#d3d8cf',
  300: '#b1b8ae',
  400: '#858f84',
  500: '#6f7c6f',
  600: '#4b574c',
  700: '#343d35',
  800: '#29312a',
  900: '#202720',
  950: '#151916',
};

const radius = {
  control: '10px',
  field: '12px',
  card: '16px',
  panel: '22px',
  sheet: '26px',
  button: '14px',
  pill: '9999px',
};

// Shadows are almost invisible: cards separate by a hairline and a tonal step, only floating things lift.
const elevation = {
  light: ['none', '0 1px 3px rgba(32, 37, 31, 0.06)', '0 8px 28px rgba(32, 37, 31, 0.1)'],
  dark: ['none', '0 1px 3px rgba(0, 0, 0, 0.35)', '0 8px 28px rgba(0, 0, 0, 0.45)'],
};

// Manrope has no Arabic glyphs, so Arabic text falls through to Noto Sans Arabic (fetched only when it appears).
const fontFamily = {
  sans: "'Manrope Variable', 'Noto Sans Arabic Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

// Type scale by role: hero 36/700, title 28/700, section 21/650, card 17/650, body 15/400, secondary 13/450,
// metadata 11/600 (weights and line heights are applied in the global CSS below).
const type = {
  hero: '2.25rem',
  title: '1.75rem',
  section: '1.3125rem',
  card: '1.0625rem',
  body: '0.9375rem',
  secondary: '0.8125rem',
  metadata: '0.6875rem',
};

const motion = { fast: '120ms', normal: '180ms', slow: '280ms' };

// Fills for initials avatars and room banners: Forest and a deeper Terracotta carry white text (5.0:1 and
// 4.9:1), Sand carries ink (9.4:1). They read on both canvases.
const tone = { green: forest, gold: sand, coral: '#b0574e' };

const palette = {
  green: status(forest, forest, sage),
  danger: status(terracotta, '#b0574e', coral),
  role: status(sand, '#8f6a28', gold),
  info: status(infoBlue, '#46709e', '#8fb0d6'),
};

export const JtalkPreset = definePreset(Aura, {
  primitive: {
    // Aura's Tailwind-default palettes, replaced. Warnings and the other warm severities are the role color.
    // `purple` (the rarely used "help" severity) stays Aura's.
    green: palette.green,
    red: palette.danger,
    yellow: palette.role,
    orange: palette.role,
    blue: palette.info,
    sky: palette.info,
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: radius.control,
      md: radius.field,
      lg: radius.card,
      xl: radius.panel,
    },
  },

  semantic: {
    primary: ramp(forest),

    transitionDuration: motion.normal,

    // WCAG 2.4.7 / 2.4.11: a clearly visible, >= 2px, >= 3:1 focus indicator.
    focusRing: { width: '2px', style: 'solid', color: '{primary.color}', offset: '2px' },

    formField: {
      borderRadius: radius.field,
      paddingX: '0.875rem',
      paddingY: '0.625rem',
    },
    content: { borderRadius: radius.control },

    overlay: {
      select: { borderRadius: radius.field, shadow: 'var(--p-jtalk-elevation-3)' },
      popover: { borderRadius: radius.card, shadow: 'var(--p-jtalk-elevation-3)' },
      modal: { borderRadius: radius.panel, shadow: 'var(--p-jtalk-elevation-3)' },
      navigation: { shadow: 'var(--p-jtalk-elevation-3)' },
    },

    colorScheme: {
      light: {
        surface: lightSurface,
        // Forest under white text: 5.0:1; hover and pressed are darker.
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        text: {
          color: '{surface.950}',
          hoverColor: '{surface.950}',
          mutedColor: '{surface.600}',
          hoverMutedColor: '{surface.700}',
        },
        // Field borders are surface 500 (3.2:1 on paper): WCAG 1.4.11.
        formField: {
          background: '{surface.0}',
          borderColor: '{surface.500}',
          hoverBorderColor: '{surface.600}',
          placeholderColor: '{surface.600}',
          iconColor: '{surface.600}',
          floatLabelColor: '{surface.600}',
          floatLabelActiveColor: '{surface.600}',
        },
        content: { hoverBackground: '{surface.100}' },
        overlay: {
          select: { borderColor: '{surface.200}' },
          popover: { borderColor: '{surface.200}' },
          modal: { borderColor: '{surface.200}' },
        },
        mask: { background: 'rgba(32, 37, 31, 0.45)' },
      },
      dark: {
        surface: darkSurface,
        // Sage, with night text on it: 7.3:1. Green means active in both themes.
        primary: {
          color: sage,
          contrastColor: '{surface.950}',
          hoverColor: mix(sage, '#ffffff', 0.2),
          activeColor: mix(sage, '#ffffff', 0.4),
        },
        text: {
          color: '{surface.100}',
          hoverColor: '{surface.50}',
          mutedColor: '{surface.300}',
          hoverMutedColor: '{surface.200}',
        },
        formField: {
          background: '{surface.900}',
          borderColor: '{surface.500}',
          hoverBorderColor: '{surface.400}',
          placeholderColor: '{surface.300}',
          iconColor: '{surface.300}',
          floatLabelColor: '{surface.300}',
          floatLabelActiveColor: '{surface.300}',
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
      // The links are pointer targets: 44px high.
      css: () => `
        .p-breadcrumb-item-link {
          display: inline-flex;
          align-items: center;
          min-height: 2.75rem;
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
        .p-menubar-item-link {
          min-height: 2.75rem;
        }
        .p-menubar-item-link-active {
          background: color-mix(in srgb, ${dt('primary.color')} 14%, transparent);
          color: ${dt('text.color')};
          font-weight: 650;
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
        light: { root: { background: '{surface.950}', color: '{surface.50}' } },
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
          font-size: var(--p-jtalk-type-metadata);
          font-weight: 600;
        }
        .p-listbox-option {
          min-height: 2.75rem;
        }
        .p-listbox-option.p-listbox-option-selected {
          box-shadow: inset 3px 0 0 var(--p-primary-color);
          font-weight: 650;
        }
      `,
    },
    card: {
      root: { borderRadius: radius.card, shadow: 'var(--p-jtalk-elevation-1)' },
      body: { padding: '1rem', gap: '0.5rem' },
      title: { fontSize: type.card, fontWeight: '650' },
      css: ({ dt }) => `
        .p-card {
          border: 1px solid ${dt('content.border.color')};
          overflow: hidden;
        }
      `,
    },
    // Avatar scale: 36 (normal), 48 (large), 88 (xlarge); 28 and 64 are set by the component.
    avatar: {
      root: { width: '2.25rem', height: '2.25rem', fontSize: '0.875rem', borderRadius: '50%' },
      lg: { width: '3rem', height: '3rem', fontSize: '1.125rem' },
      xl: { width: '5.5rem', height: '5.5rem', fontSize: '1.75rem' },
    },
    // Badges: small, labeled, pill-shaped; the role colors come from the severities.
    tag: {
      root: {
        fontSize: type.metadata,
        fontWeight: '600',
        padding: '0.125rem 0.5rem',
        borderRadius: radius.pill,
      },
    },
    toast: { root: { borderRadius: radius.card } },
    message: { root: { borderRadius: radius.card } },
    button: {
      root: {
        borderRadius: radius.button,
        roundedBorderRadius: radius.pill,
        label: { fontWeight: '650' },
        paddingY: '0.625rem',
        paddingX: '1.125rem',
        iconOnlyWidth: '2.75rem',
        sm: { iconOnlyWidth: '2.75rem' },
        lg: { iconOnlyWidth: '3rem' },
      },
      // 44px minimum target, and a quick press: a 2% scale in 120ms.
      css: () => `
        .p-button {
          min-height: 2.75rem;
          transition-duration: var(--p-jtalk-motion-fast);
        }
        .p-button:not(:disabled):active {
          transform: scale(0.98);
        }
      `,
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
    checkbox: { root: { width: '1.5rem', height: '1.5rem' } },
    radiobutton: { root: { width: '1.5rem', height: '1.5rem' } },
  },

  // Exposed as CSS variables (--p-jtalk-font-sans, --p-jtalk-type-title, --p-jtalk-radius-card, ...).
  extend: { jtalk: { font: fontFamily, type, tone, motion, radius } },

  css: ({ dt }) => `
    /* Semantic colors: green means active, gold elevated permissions, red danger, in both themes. */
    :root {
      --p-jtalk-brand: ${forest};
      --p-jtalk-moderator: ${sand};
      --p-jtalk-danger: ${terracotta};
      --p-jtalk-elevation-1: ${elevation.light[0]};
      --p-jtalk-elevation-2: ${elevation.light[1]};
      --p-jtalk-elevation-3: ${elevation.light[2]};
    }

    .app-dark {
      --p-jtalk-brand: ${sage};
      --p-jtalk-moderator: ${gold};
      --p-jtalk-danger: ${coral};
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
      line-height: 1.55;
    }

    h1 { font-size: ${dt('jtalk.type.title')}; font-weight: 700; line-height: 1.2; }
    h2 { font-size: ${dt('jtalk.type.section')}; font-weight: 650; line-height: 1.3; }
    h3 { font-size: ${dt('jtalk.type.card')}; font-weight: 650; line-height: 1.35; }

    /* Counts and timers keep their width as they change. */
    .p-tag, .p-badge, time {
      font-variant-numeric: tabular-nums;
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
