import { evaluate } from '../../../src/common/types/evaluate';
import {
    BuiltinFunctionExpression,
    IntersectionExpression,
    UnionExpression,
} from '../../../src/common/types/expression';
import { TypeDefinitions } from '../../../src/common/types/typedef';
import {
    expressions,
    numbers,
    orderedPairs,
    potentiallyInvalidExpressions,
    sets,
    types,
    unorderedPairs,
} from './data';

const definitions = new TypeDefinitions();

test('Expression evaluation', () => {
    const actual = [...expressions, ...potentiallyInvalidExpressions]
        .map((e) => {
            let result;
            try {
                result = evaluate(e, definitions).toString();
            } catch (error) {
                result = String(error);
            }
            return `${e.toString()} => ${result}`;
        })
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
    test('associative', () => {
        for (const a of types) {
            for (const b of types) {
                for (const c of types) {
                    const expected = evaluate(
                        new UnionExpression([
                            a,
                            evaluate(new UnionExpression([b, c]), definitions),
                        ]),
                        definitions
                    ).getTypeId();
                    const actual = evaluate(
                        new UnionExpression([
                            evaluate(new UnionExpression([a, b]), definitions),
                            c,
                        ]),
                        definitions
                    ).getTypeId();
                    expect(actual).toBe(expected);
                }
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
    test('associative', () => {
        for (const a of types) {
            for (const b of types) {
                for (const c of types) {
                    const expected = evaluate(
                        new IntersectionExpression([
                            a,
                            evaluate(new IntersectionExpression([b, c]), definitions),
                        ]),
                        definitions
                    ).getTypeId();
                    const actual = evaluate(
                        new IntersectionExpression([
                            evaluate(new IntersectionExpression([a, b]), definitions),
                            c,
                        ]),
                        definitions
                    ).getTypeId();
                    expect(actual).toBe(expected);
                }
            }
        }
    });
});

describe('Builtin functions', () => {
    const testUnaryNumber = (name: string) => {
        test(name, () => {
            const actual = [...numbers, ...sets]
                .map((e) => new BuiltinFunctionExpression(name, [e]))
                .map((e) => {
                    let result;
                    try {
                        result = evaluate(e, definitions).toString();
                    } catch (error) {
                        result = String(error);
                    }
                    return `${e.toString()} => ${result}`;
                })
                .join('\n');
            expect(actual).toMatchSnapshot();
        });
    };
    const testBinaryNumber = (name: string, properties: { commutative: boolean }) => {
        describe(name, () => {
            test('evaluate', () => {
                const inputs = properties.commutative
                    ? unorderedPairs(numbers)
                    : orderedPairs(numbers);

                const actual = inputs
                    .map((args) => new BuiltinFunctionExpression(name, args))
                    .map((e) => {
                        let result;
                        try {
                            result = evaluate(e, definitions).toString();
                        } catch (error) {
                            result = String(error);
                        }
                        return `${e.toString()} => ${result}`;
                    })
                    .join('\n');
                expect(actual).toMatchSnapshot();
            });

            if (properties.commutative) {
                test('commutative', () => {
                    for (const a of numbers) {
                        for (const b of numbers) {
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
            }
        });
    };

    testUnaryNumber('negate');
    testUnaryNumber('round');

    testBinaryNumber('min', { commutative: true });
    testBinaryNumber('add', { commutative: true });
});
