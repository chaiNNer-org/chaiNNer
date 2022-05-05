// theme.js

// 1. import `extendTheme` function
import { extendTheme, Theme } from '@chakra-ui/react';

// 2. Add your color mode config
const config = {
    initialColorMode: 'dark',
    useSystemColorMode: true,
    fonts: {
        heading: 'Open Sans',
    },
} as const;

// 3. extend the theme
const theme = extendTheme({ config } as const) as Theme;

export default theme;
