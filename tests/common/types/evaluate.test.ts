import { reciprocal } from '../../../src/common/types/builtin';
import { evaluate } from '../../../src/common/types/evaluate';
import {
    BuiltinFunctionExpression,
    Expression,
    IntersectionExpression,
    MatchArm,
    MatchExpression,
    UnionExpression,
} from '../../../src/common/types/expression';
import { isSubsetOf } from '../../../src/common/types/relation';
import { literal } from '../../../src/common/types/type-util';
import { BuiltinFunctionDefinition, TypeDefinitions } from '../../../src/common/types/typedef';
import {
    AnyType,
    NeverType,
    NumberType,
    PrimitiveType,
    StringLiteralType,
    StringType,
    Type,
    UnionType,
} from '../../../src/common/types/types';
import { union } from '../../../src/common/types/union';
import { without } from '../../../src/common/types/without';
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

describe('without', () => {
    const primitives: (PrimitiveType | NeverType | AnyType | UnionType<PrimitiveType>)[] = [];
    for (const t of types) {
        if (
            t.underlying === 'any' ||
            t.underlying === 'never' ||
            t.underlying === 'number' ||
            t.underlying === 'string'
        ) {
            primitives.push(t);
        } else if (
            t.underlying === 'union' &&
            t.items.every((i) => i.underlying === 'string' || i.underlying === 'number')
        ) {
            primitives.push(t as UnionType<PrimitiveType>);
        }
    }

    test('evaluation', () => {
        const isNumberType = (t: Type) => t.type !== 'never' && isSubsetOf(t, NumberType.instance);
        const isStringType = (t: Type) => t.type !== 'never' && isSubsetOf(t, StringType.instance);
        const actual = orderedPairs(primitives)
            .filter(
                ([a, b]) =>
                    !((isNumberType(a) && isStringType(b)) || (isStringType(a) && isNumberType(b)))
            )
            .map(([a, b]) => {
                let result;
                try {
                    result = without(a, b).toString();
                } catch (error) {
                    result = String(error);
                }
                return `${a.toString()} \\ ${b.toString()} => ${result}`;
            })
            .join('\n');
        expect(actual).toMatchSnapshot();
    });

    test('A \\ A = never', () => {
        for (const a of primitives) {
            for (const b of primitives) {
                const u = union(a, b);
                const actual = without(u, u as never);
                if (actual.type !== 'never') {
                    const prefix = `A = ${u.toString()}\nA \\ A = `;
                    expect(prefix + actual.toString()).toBe(`${prefix}never`);
                }
            }
        }
    });
    test('((a | b) \\ a) \\ b = never', () => {
        for (const a of primitives) {
            for (const b of primitives) {
                const actual = without(without(union(a, b), a), b);
                if (actual.type !== 'never') {
                    const prefix = `a = ${a.toString()}\nb = ${b.toString()}\n((a | b) \\ a) \\ b = `;
                    expect(prefix + actual.toString()).toBe(`${prefix}never`);
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
    testBinaryNumber('multiply', { commutative: true, reflexive: false, associative: false });
});

describe('Match', () => {
    // typeName(x) = match x { number => "number", string => "string", null => "null", any => "other" }
    const typeName = (e: Expression) =>
        new MatchExpression(e, [
            new MatchArm(literal(2), undefined, new StringLiteralType('2')),
            new MatchArm(NumberType.instance, undefined, new StringLiteralType('number')),
            new MatchArm(StringType.instance, undefined, new StringLiteralType('string')),
            new MatchArm('null', undefined, new StringLiteralType('null')),
            new MatchArm(AnyType.instance, undefined, new StringLiteralType('other')),
        ]);

    test('no arms', () => {
        for (const type of types) {
            assertSame(new MatchExpression(type, []), NeverType.instance);
        }
    });
    test('default', () => {
        const value = new StringLiteralType('hey yo');
        for (const type of types) {
            const expected = type.type === 'never' ? NeverType.instance : value;
            assertSame(
                new MatchExpression(type, [new MatchArm(AnyType.instance, undefined, value)]),
                expected
            );
        }
    });
    test('type name mapping', () => {
        // by the properties of match, typeName(X | Y) == typeName(X) | typeName(Y)
        for (const a of types) {
            for (const b of types) {
                assertSame(
                    typeName(new UnionExpression([a, b])),
                    new UnionExpression([typeName(a), typeName(b)])
                );
            }
        }
    });

    test('evaluate', () => {
        const actual = types
            .map(typeName)
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
});
