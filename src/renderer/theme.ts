import { Theme, extendTheme } from '@chakra-ui/react';

// This is the initial theme config on startup
const dark = {
    initialColorMode: 'dark',
    useSystemColorMode: false,
} as const;

// TODO: This should be used later after reading the theme settings.
// When light, change the theme to this values before displaying the
// window. Need to figure out where and when to load the new theme.
// Currently this does nothing.
const light = {
    initialColorMode: 'light',
    useSystemColorMode: false,
} as const;

// TODO: This should be used later to dynamically change the theme,
// when the OS changes from dark to light or vice versa. Need to
// figure out where and when to load the new theme. Currently this
// does nothing.

const system = {
    initialColorMode: 'system',
    useSystemColorMode: true,
} as const;

const grays = [50, 100, 200, 300, 400, 500, 600, 650, 700, 750, 800, 850, 900];
const colors = {
    gray: Object.fromEntries(grays.map((v) => [v, `var(--theme-${v})`])),
};

const fonts = {
    heading: `Open Sans, sans-serif`,
    body: `Open Sans, sans-serif`,
    monospace: `Roboto-Mono, monospace`,
};

export const darktheme = extendTheme({ config: dark, colors, fonts } as const) as Theme;

export const lighttheme = extendTheme({ config: light, colors, fonts } as const) as Theme;

export const systemtheme = extendTheme({ config: system, colors, fonts } as const) as Theme;
