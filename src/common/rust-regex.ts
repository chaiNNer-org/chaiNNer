import wasmUrl from 'rregex/lib/rregex.wasm?url';
import init, { RRegex as _rr } from 'rregex/lib/web';
import { log } from './log';

// This is not good, but I can't think of a better way.
// We are racing loading the wasm module and using it.
init(wasmUrl).catch(log.error);

export class RRegex extends _rr {}
