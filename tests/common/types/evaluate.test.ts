import { reciprocal } from '../../../src/common/types/builtin';
import { evaluate } from '../../../src/common/types/evaluate';
import {
    BuiltinFunctionExpression,
    Expression,
    IntersectionExpression,
    UnionExpression,
} from '../../../src/common/types/expression';
import { BuiltinFunctionDefinition, TypeDefinitions } from '../../../src/common/types/typedef';
import { NumberType } from '../../../src/common/types/types';
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
definitions.addFunction(
    BuiltinFunctionDefinition.unary('reciprocal', reciprocal, NumberType.instance)
);

const assertSame = (a: Expression, b: Expression): void => {
    const expected = evaluate(a, definitions).getTypeId();
    const actual = evaluate(b, definitions).getTypeId();
    if (expected !== actual) {
        const prefix = `a = ${a.toString()}\nb = ${b.toString()}\n`;
        expect(prefix + actual).toBe(prefix + expected);
    }
};

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
    test('reflexive', () => {
        for (const expression of expressions) {
            assertSame(expression, new UnionExpression([expression, expression]));
        }
    });
    test('commutative', () => {
        for (const a of types) {
            for (const b of types) {
                assertSame(new UnionExpression([a, b]), new UnionExpression([b, a]));
            }
        }
    });
    test('associative', () => {
        for (const a of types) {
            for (const b of types) {
                for (const c of types) {
                    assertSame(
                        new UnionExpression([
                            a,
                            evaluate(new UnionExpression([b, c]), definitions),
                        ]),
                        new UnionExpression([evaluate(new UnionExpression([a, b]), definitions), c])
                    );
                }
            }
        }
    });
});

describe('intersection', () => {
    test('reflexive', () => {
        for (const expression of expressions) {
            assertSame(expression, new IntersectionExpression([expression, expression]));
        }
    });
    test('commutative', () => {
        for (const a of types) {
            for (const b of types) {
                assertSame(new IntersectionExpression([a, b]), new IntersectionExpression([b, a]));
            }
        }
    });
    test('associative', () => {
        for (const a of types) {
            for (const b of types) {
                for (const c of types) {
                    assertSame(
                        new IntersectionExpression([
                            a,
                            evaluate(new IntersectionExpression([b, c]), definitions),
                        ]),
                        new IntersectionExpression([
                            evaluate(new IntersectionExpression([a, b]), definitions),
                            c,
                        ])
                    );
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
    const testBinaryNumber = (
        name: string,
        properties: { commutative: boolean; reflexive: boolean; associative: boolean }
    ) => {
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
                            assertSame(
                                new BuiltinFunctionExpression(name, [a, b]),
                                new BuiltinFunctionExpression(name, [b, a])
                            );
                        }
                    }
                });
            }

            if (properties.reflexive) {
                test('reflexive', () => {
                    for (const a of numbers) {
                        assertSame(a, new BuiltinFunctionExpression(name, [a, a]));
                    }
                });
            }

            if (properties.associative) {
                test('associative', () => {
                    for (const a of numbers) {
                        for (const b of numbers) {
                            for (const c of numbers) {
                                assertSame(
                                    new BuiltinFunctionExpression(name, [
                                        a,
                                        evaluate(
                                            new BuiltinFunctionExpression(name, [b, c]),
                                            definitions
                                        ),
                                    ]),
                                    new BuiltinFunctionExpression(name, [
                                        evaluate(
                                            new BuiltinFunctionExpression(name, [a, b]),
                                            definitions
                                        ),
                                        c,
                                    ])
                                );
                            }
                        }
                    }
                });
            }
        });
    };

    testUnaryNumber('negate');
    testUnaryNumber('round');
    testUnaryNumber('reciprocal');

    testBinaryNumber('min', { commutative: true, reflexive: true, associative: true });
    testBinaryNumber('add', { commutative: true, reflexive: false, associative: false });
});
