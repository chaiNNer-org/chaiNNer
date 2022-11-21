// https://www.i18next.com/overview/typescript#create-a-declaration-file
// https://www.i18next.com/overview/typescript#custom-type-options

import 'i18next';

declare module 'i18next' {
    // Extend CustomTypeOptions
    interface CustomTypeOptions {
        returnNull: false;
    }
}
