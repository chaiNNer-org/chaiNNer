/* eslint-disable import/no-default-export */

declare module '*.svg' {
    const content: string;
    export default content;
}
declare module '*.png' {
    const content: string;
    export default content;
}
declare module '*.gif' {
    const content: string;
    export default content;
}
declare module '*.jpg' {
    const content: string;
    export default content;
}
declare module '*.jpeg' {
    const content: string;
    export default content;
}

declare module 'rregex/lib/rregex.wasm?url' {
    const content: string;
    export default content;
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
