import { assertNever } from '../util';
import { Expression } from './expression';

export function* getReferences(expression: Expression): Iterable<string> {
    if (expression.type === 'named') {
        yield expression.name;
    }

    if (expression.underlying === 'expression') {
        switch (expression.type) {
            case 'intersection':
            case 'union':
                for (const e of expression.items) {
                    yield* getReferences(e);
                }
                break;
            case 'named':
                for (const f of expression.fields) {
                    yield* getReferences(f.type);
                }
                break;
            case 'field-access':
                yield* getReferences(expression.of);
                break;
            case 'builtin-function':
                for (const f of expression.args) {
                    yield* getReferences(f);
                }
                break;
            case 'match':
                for (const arm of expression.arms) {
                    yield* getReferences(arm.to);
                }
                break;
            default:
                yield assertNever(expression);
        }
    }
}
