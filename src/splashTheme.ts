import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
    styles: {
        global: {
            // styles for the `body`
            body: {
                bg: 'none',
            },
        },
    },
});

export default theme;
