import { isRenderer } from './env';
import { log } from './log';

let imports;
if (isRenderer) {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    imports = require('rregex/lib/browser') as typeof import('rregex');

    // This is not good, but I can't think of a better way.
    // We are racing loading the wasm module and using it.
    imports.default().catch(log.error);
} else {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    imports = require('rregex/lib/commonjs') as typeof import('rregex');
}

export class RRegex extends imports.RRegex {}
