// theme.js

// 1. import `extendTheme` function
import { Theme, extendTheme } from '@chakra-ui/react';

// 2. Add your color mode config
const config = {
    initialColorMode: 'dark',
    useSystemColorMode: true,
} as const;

const colors = {
    // gray: {
    //     50: '#171923',
    //     100: '#1A202C',
    //     200: '#2D3748',
    //     300: '#4A5568',
    //     400: '#718096',
    //     500: '#A0AEC0',
    //     600: '#CBD5E0',
    //     700: '#E2E8F0',
    //     800: '#EDF2F7',
    //     900: '#F7FAFC',
    // },
    // gray: {
    //     '50': '#FBE5FF',
    //     '100': '#F3B8FF',
    //     '200': '#EC8AFF',
    //     '300': '#E45CFF',
    //     '400': '#DD2EFF',
    //     '500': '#D500FF',
    //     '600': '#AA00CC',
    //     '700': '#800099',
    //     '800': '#550066',
    //     '900': '#2B0033',
    // },
    gray: {
        '900': '#151a24',
    },
};

const fonts = {
    // heading: 'Open Sans',
};

// 3. extend the theme
const theme = extendTheme({ config, colors, fonts } as const) as Theme;

export default theme;
