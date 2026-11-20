import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';

type Slot = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
type Scale = Record<Slot, string>;

const forest = '#477a5d';
const sage = '#80b18d';
const sand = '#dcc79e';
const gold = '#c9af7e';
const actionBlue = '#2f80ed';
const actionBlueDark = '#5b9bf0';
const terracotta = '#c9685e';
const coral = '#df8277';
const infoBlue = '#6389b5';
const ink = '#20251f';

const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);

function mix(base: string, to: string, amount: number): string {
  const part = (at: number) =>
    Math.round(channel(base, at) + (channel(to, at) - channel(base, at)) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

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

const elevation = {
  light: ['none', '0 1px 3px rgba(32, 37, 31, 0.06)', '0 8px 28px rgba(32, 37, 31, 0.1)'],
  dark: ['none', '0 1px 3px rgba(0, 0, 0, 0.35)', '0 8px 28px rgba(0, 0, 0, 0.45)'],
};

const fontFamily = {
  sans: "'Manrope Variable', 'Noto Sans Arabic Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

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

const tone = { green: forest, gold: sand, coral: '#b0574e' };

const palette = {
  green: status(forest, forest, sage),
  danger: status(terracotta, '#b0574e', coral),
  role: status(sand, '#8f6a28', gold),
  info: status(infoBlue, '#46709e', '#8fb0d6'),
};

export const JtalkPreset = definePreset(Aura, {
  primitive: {
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
      css: () => `
        .p-breadcrumb-item-link {
          display: inline-flex;
          align-items: center;
          min-height: 2.75rem;
        }
      `,
    },
    menubar: {
      // The bar along the bottom of a phone: each destination an icon over its name, the current one in Forest, and More opening upward.
      root: {
        background: 'transparent',
        borderColor: 'transparent',
        borderRadius: '0',
        padding: '0.25rem 0.5rem',
      },
      item: { padding: '0.375rem 0', gap: '0.125rem' },
      css: ({ dt }) => `
        .p-menubar {
          position: relative;
        }
        .p-menubar-root-list {
          flex: 1;
          gap: 0.25rem;
        }
        .p-menubar-root-list > .p-menubar-item {
          flex: 1;
        }
        .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content {
          block-size: 100%;
        }
        .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content > .p-menubar-item-link {
          flex-direction: column;
          justify-content: center;
          min-height: 3.5rem;
          color: ${dt('text.muted.color')};
          font-size: ${dt('jtalk.type.metadata')};
          font-weight: 600;
        }
        .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content .p-menubar-item-icon {
          color: inherit;
          font-size: 1.375rem;
        }
        .p-menubar-root-list > .p-menubar-item > .p-menubar-item-content .p-menubar-submenu-icon {
          display: none;
        }
        .p-menubar-item-link-active {
          background: color-mix(in srgb, ${dt('primary.color')} 14%, transparent);
          color: ${dt('primary.color')};
          font-weight: 700;
        }
        .p-menubar-item-link.live-item {
          color: ${dt('primary.color')};
        }
        .p-menubar-submenu {
          inset-block-start: auto;
          inset-block-end: 100%;
          inset-inline-start: auto;
          inset-inline-end: 0;
          min-inline-size: 12rem;
          margin-block-end: 0.5rem;
        }
        .p-menubar-submenu .p-menubar-item-link {
          flex-direction: row;
          justify-content: flex-start;
          min-height: 2.75rem;
          font-size: ${dt('jtalk.type.body')};
          font-weight: 500;
        }
        .p-menubar-submenu .p-menubar-item-link {
          gap: 0.75rem;
          padding-inline: 1rem;
        }
        .p-menubar-submenu .p-menubar-item-icon {
          color: ${dt('text.color')};
          font-size: 1.125rem;
        }
        .p-menubar-item-link.danger-item,
        .p-menubar-item-link.danger-item .p-menubar-item-icon {
          color: var(--p-red-500);
        }
        .app-dark .p-menubar-item-link.danger-item,
        .app-dark .p-menubar-item-link.danger-item .p-menubar-item-icon {
          color: var(--p-red-400);
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
    card: {
      root: { borderRadius: radius.card, shadow: 'var(--p-jtalk-elevation-1)' },
      body: { padding: '1rem', gap: '0.5rem' },
      title: { fontSize: type.card, fontWeight: '650' },
      css: ({ dt }) => `
        .p-card {
          display: flex;
          flex-direction: column;
          border: 1px solid ${dt('content.border.color')};
          overflow: hidden;
        }
        .p-card-body,
        .p-card-content {
          display: flex;
          flex: 1;
          flex-direction: column;
        }
      `,
    },
    avatar: {
      root: { width: '2.25rem', height: '2.25rem', fontSize: '0.875rem', borderRadius: '50%' },
      lg: { width: '3rem', height: '3rem', fontSize: '1.125rem' },
      xl: { width: '5.5rem', height: '5.5rem', fontSize: '1.75rem' },
    },
    tag: {
      root: {
        fontSize: type.metadata,
        fontWeight: '600',
        padding: '0.125rem 0.5rem',
        borderRadius: radius.pill,
      },
    },
    togglebutton: {
      colorScheme: {
        light: { root: { color: '{surface.600}', hoverColor: '{surface.800}' } },
      },
    },
    selectbutton: {
      css: () => `
        .p-selectbutton .p-togglebutton {
          flex-shrink: 0;
          white-space: nowrap;
        }
      `,
    },
    toolbar: {
      root: { borderRadius: radius.panel, padding: '0.75rem 1rem', gap: '0.75rem' },
      css: () => `
        .p-toolbar {
          box-shadow: var(--p-jtalk-elevation-2);
        }
      `,
    },
    menu: {
      // The sidebar's navigation (a menu that is not a popup) sits on the rail: roomy rows, the page you are on a tonal pill with a Forest
      // icon and heavier text.
      item: { borderRadius: radius.control },
      css: ({ dt }) => `
        .p-menu:not(.p-menu-overlay) {
          background: transparent;
          border-color: transparent;
          box-shadow: none;
        }
        .p-menu:not(.p-menu-overlay) .p-menu-list {
          gap: 0.25rem;
          padding: 0;
        }
        .p-menu:not(.p-menu-overlay) .p-menu-item-link {
          min-height: 2.75rem;
          padding-inline: 0.875rem;
          gap: 0.75rem;
          font-size: ${dt('jtalk.type.body')};
          font-weight: 550;
        }
        .p-menu:not(.p-menu-overlay) .p-menu-item-icon {
          color: ${dt('text.color')};
          font-size: 1.25rem;
        }
        .p-menu:not(.p-menu-overlay) .p-menu-item-link:hover {
          background: ${dt('content.hover.background')};
        }
        .p-menu:not(.p-menu-overlay) .p-menu-item-link-active {
          background: color-mix(in srgb, ${dt('primary.color')} 14%, transparent);
          font-weight: 700;
        }
        .p-menu:not(.p-menu-overlay) .p-menu-item-link-active .p-menu-item-icon {
          color: ${dt('primary.color')};
        }
        .p-menu-item-link.danger-item,
        .p-menu-item-link.danger-item .p-menu-item-icon {
          color: var(--p-red-500);
        }
        .app-dark .p-menu-item-link.danger-item,
        .app-dark .p-menu-item-link.danger-item .p-menu-item-icon {
          color: var(--p-red-400);
        }
      `,
    },
    panel: {
      root: { background: 'transparent', borderColor: 'transparent' },
      header: { background: 'transparent', padding: '0.25rem 0.5rem' },
      content: { padding: '0' },
    },
    dialog: {
      // A person's card is built edge to edge (a footer strip across the bottom), so it keeps no padding of its own. On a phone it is a
      // sheet that rises from the bottom edge, the way people expect a profile to open there.
      css: () => `
        .p-dialog.person-card {
          inline-size: min(30rem, 95vw);
        }
        .p-dialog.person-card .p-dialog-content {
          padding: 0;
        }
        @media (max-width: 40rem) {
          .p-dialog-mask:has(.p-dialog.person-card) {
            /* the dialog sets its own alignment inline, which only !important beats */
            align-items: flex-end !important;
            padding: 0;
          }
          .p-dialog.person-card {
            inline-size: 100%;
            max-inline-size: 100%;
            max-block-size: 88dvh;
            margin: 0;
            border-start-start-radius: var(--p-jtalk-radius-sheet);
            border-start-end-radius: var(--p-jtalk-radius-sheet);
            border-end-start-radius: 0;
            border-end-end-radius: 0;
          }
        }
      `,
    },
    drawer: {
      // The discussion fills the drawer edge to edge, so the drawer keeps no padding of its own. On a phone it is a sheet that rises from the
      // bottom edge with the sheet radius.
      header: { padding: '1rem 1.25rem' },
      content: { padding: '0' },
      css: () => `
        .p-drawer.chat-drawer .p-drawer-content {
          display: flex;
          flex-direction: column;
          min-block-size: 0;
        }
        .p-drawer.chat-drawer.p-drawer-bottom {
          border-start-start-radius: var(--p-jtalk-radius-sheet);
          border-start-end-radius: var(--p-jtalk-radius-sheet);
        }
      `,
    },
    tabs: {
      // Tabs sit on the open canvas: no panel box, a hairline under the list, and the same 44px targets as every control.
      tablist: { background: 'transparent' },
      tabpanel: { background: 'transparent', padding: '1rem 0 0' },
      css: () => `
        .p-tab {
          min-height: 2.75rem;
        }
      `,
    },
    accordion: {
      // A quiet disclosure, not a boxed panel: a line of text with a chevron, open to reveal what is behind it.
      panel: { borderWidth: '0', borderColor: 'transparent' },
      header: {
        background: 'transparent',
        hoverBackground: 'transparent',
        activeBackground: 'transparent',
        activeHoverBackground: 'transparent',
        padding: '0.5rem 0',
        borderRadius: '0',
      },
      content: { background: 'transparent', padding: '0 0 0.5rem' },
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
      css: () => `
        .p-button {
          min-height: 2.75rem;
          transition-duration: var(--p-jtalk-motion-fast);
        }
        .p-button:not(:disabled):active {
          transform: scale(0.98);
        }
        .p-button.compact {
          position: relative;
          min-height: 2.25rem;
          padding-block: 0.375rem;
          padding-inline: 0.875rem;
          font-size: var(--p-jtalk-type-secondary);
        }
        .p-button.compact.p-button-icon-only {
          inline-size: 2.25rem;
          block-size: 2.25rem;
          padding: 0;
        }
        .p-button.compact::after {
          content: '';
          position: absolute;
          inset: -0.25rem;
        }
        @container dock (max-width: 30rem) {
          .p-button.leave-compact {
            inline-size: 3rem;
            padding-inline: 0;
          }
          .p-button.leave-compact .p-button-label {
            display: none;
          }
          .p-button.hand {
            inline-size: 3rem;
            padding-inline: 0;
          }
          .p-button.hand .p-button-label {
            display: none;
          }
        }
      `,
      colorScheme: {
        light: {
          outlined: {
            primary: { borderColor: '{primary.color}' },
            secondary: { borderColor: '{surface.500}', color: '{surface.800}' },
            warn: { borderColor: '{yellow.500}' },
            danger: { borderColor: '{red.500}' },
          },
          text: { secondary: { color: '{surface.600}' } },
        },
        dark: {
          outlined: {
            primary: { borderColor: '{primary.color}' },
            secondary: { borderColor: '{surface.500}', color: '{surface.200}' },
            warn: { borderColor: '{yellow.400}' },
            danger: { borderColor: '{red.400}' },
          },
          text: { secondary: { color: '{surface.300}' } },
        },
      },
    },
    checkbox: { root: { width: '1.5rem', height: '1.5rem' } },
    radiobutton: { root: { width: '1.5rem', height: '1.5rem' } },
  },

  extend: { jtalk: { font: fontFamily, type, tone, motion, radius } },

  css: ({ dt }) => `
    :root {
      --p-jtalk-brand: ${forest};
      --p-jtalk-moderator: ${sand};
      --p-jtalk-action: ${actionBlue};
      --p-jtalk-danger: ${terracotta};
      --p-jtalk-elevation-1: ${elevation.light[0]};
      --p-jtalk-elevation-2: ${elevation.light[1]};
      --p-jtalk-elevation-3: ${elevation.light[2]};
    }

    .app-dark {
      --p-jtalk-brand: ${sage};
      --p-jtalk-moderator: ${gold};
      --p-jtalk-action: ${actionBlueDark};
      --p-jtalk-danger: ${coral};
      --p-jtalk-elevation-1: ${elevation.dark[0]};
      --p-jtalk-elevation-2: ${elevation.dark[1]};
      --p-jtalk-elevation-3: ${elevation.dark[2]};
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

    .pi-hand {
      display: inline-block;
      inline-size: 1em;
      block-size: 1em;
      background: currentColor;
      mask: url('/icons/hand.svg') center / contain no-repeat;
    }

    .pi-slashed {
      position: relative;
    }
    .pi-slashed::after {
      content: '';
      position: absolute;
      inset-inline: -0.1em;
      top: 50%;
      border-block-start: 0.14em solid currentColor;
      transform: rotate(-45deg);
    }
    .pi-microphone.pi-slashed::before {
      content: '';
      display: inline-block;
      inline-size: 1em;
      block-size: 1em;
      background: currentColor;
      mask: url('/icons/microphone-slash.svg') center / contain no-repeat;
    }
    .pi-microphone.pi-slashed::after {
      display: none;
    }

    .p-tag, .p-badge, time {
      font-variant-numeric: tabular-nums;
    }

    code, kbd, pre, samp {
      font-family: ${dt('jtalk.font.mono')};
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `,
});
