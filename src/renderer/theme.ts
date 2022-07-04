// theme.js

// 1. import `extendTheme` function
import { Theme, extendTheme } from '@chakra-ui/react';
import { interpolateColor } from './helpers/colorTools';

// 2. Add your color mode config
const config = {
    initialColorMode: 'dark',
    useSystemColorMode: false,
} as const;

const blueGray = {
    50: '#F7FAFC',
    100: '#EDF2F7',
    200: '#E2E8F0',
    300: '#CBD5E0',
    400: '#A0AEC0',
    500: '#718096',
    600: '#4A5568',
    700: '#2D3748',
    800: '#1A202C',
    900: '#171923',
};

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
    // gray: {
    //     '900': '#151a24',
    // },
    // gray: {
    //     '50': '#f9fafa',
    //     '100': '#f1f1f2',
    //     '200': '#e7e7e8',
    //     '300': '#d3d4d6',
    //     '400': '#abadb0',
    //     '500': '#7c7f84',
    //     '600': '#51555b',
    //     '650': interpolateColor('#51555b', '#32373f', 0.5),
    //     '700': '#32373f',
    //     '750': interpolateColor('#32373f', '#1d2026', 0.5),
    //     '800': '#1d2026',
    //     '850': interpolateColor('#1d2026', '#171a1e', 0.5),
    //     '900': '#171a1e',
    // },
    gray: {
        ...blueGray,
        '650': interpolateColor(blueGray[600], blueGray[700], 0.5),
        '750': interpolateColor(blueGray[700], blueGray[800], 0.5),
        '850': interpolateColor(blueGray[800], blueGray[900], 0.5),
    },
};

const fonts = {
    // heading: 'Open Sans',
};

// 3. extend the theme
const theme = extendTheme({ config, colors, fonts } as const) as Theme;

export default theme;
