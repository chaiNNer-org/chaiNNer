import { Theme, extendTheme } from '@chakra-ui/react';

const config = {
    initialColorMode: 'dark',
    useSystemColorMode: false,
} as const;

const grays = [50, 100, 200, 300, 400, 500, 600, 650, 700, 750, 800, 850, 900];
const colors = {
    gray: Object.fromEntries(grays.map((v) => [v, `var(--gray-${v})`])),
};

export const theme = extendTheme({ config, colors } as const) as Theme;
