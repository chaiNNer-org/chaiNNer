import { evaluate } from '../../../src/common/types/evaluate';
import { IntersectionExpression, UnionExpression } from '../../../src/common/types/expression';
import { TypeDefinitions } from '../../../src/common/types/typedef';
import { expressions, types } from './data';

const definitions = new TypeDefinitions();

test('Expression evaluation', () => {
    const actual = expressions
        .map((e) => `${e.toString()} => ${evaluate(e, definitions).toString()}`)
        .join('\n');
    expect(actual).toMatchSnapshot();
});

describe('union', () => {
    test('Reflective', () => {
        for (const expression of expressions) {
            const expected = evaluate(expression, definitions).getTypeId();
            const actual = evaluate(
                new UnionExpression([expression, expression]),
                definitions
            ).getTypeId();
            expect(actual).toBe(expected);
        }
    });
    test('commutative', () => {
        for (const a of types) {
            for (const b of types) {
                const expected = evaluate(new UnionExpression([a, b]), definitions).getTypeId();
                const actual = evaluate(new UnionExpression([b, a]), definitions).getTypeId();
                expect(actual).toBe(expected);
            }
        }
    });
});

describe('intersection', () => {
    test('Reflective', () => {
        for (const expression of expressions) {
            const expected = evaluate(expression, definitions).getTypeId();
            const actual = evaluate(
                new IntersectionExpression([expression, expression]),
                definitions
            ).getTypeId();
            expect(actual).toBe(expected);
        }
    });
    test('commutative', () => {
        for (const a of types) {
            for (const b of types) {
                const expected = evaluate(
                    new IntersectionExpression([a, b]),
                    definitions
                ).getTypeId();
                const actual = evaluate(
                    new IntersectionExpression([b, a]),
                    definitions
                ).getTypeId();
                expect(actual).toBe(expected);
            }
        }
    });
});
