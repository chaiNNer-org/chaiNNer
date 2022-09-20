import { reciprocal } from '../../../src/common/types/builtin';
import { getChainnerScope } from '../../../src/common/types/chainner-scope';
import { evaluate } from '../../../src/common/types/evaluate';
import {
    Expression,
    FunctionCallExpression,
    IntersectionExpression,
    MatchArm,
    MatchExpression,
    NamedExpression,
    UnionExpression,
} from '../../../src/common/types/expression';
import { BuiltinFunctionDefinition, ScopeBuilder } from '../../../src/common/types/scope';
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
import { literal } from '../../../src/common/types/util';
import { without } from '../../../src/common/types/without';
import {
    expressions,
    numbers,
    orderedPairs,
    potentiallyInvalidExpressions,
    sets,
    strings,
    types,
    unorderedPairs,
} from './data';

const scopeBuilder = new ScopeBuilder('test scope', getChainnerScope());
scopeBuilder.add(BuiltinFunctionDefinition.unary('reciprocal', reciprocal, NumberType.instance));
const scope = scopeBuilder.createScope();

const assertSame = (a: Expression, b: Expression): void => {
    const expected = evaluate(a, scope).getTypeId();
    const actual = evaluate(b, scope).getTypeId();
    if (expected !== actual) {
        const prefix = `a = ${a.toString()}\nb = ${b.toString()}\n`;
        expect(prefix + actual).toBe(prefix + expected);
    }
};

const isIncompatibleUnderlyingType = (a: Type, b: Type): boolean => {
    if (a.underlying === 'any' || a.underlying === 'never') return false;
    if (b.underlying === 'any' || b.underlying === 'never') return false;

    const getApproximateUnderlying = (t: Type): Type['underlying'] => {
        if (t.underlying !== 'union') return t.underlying;
        const u = [...new Set(t.items.map((i) => i.underlying))];
        if (u.length === 1) return u[0];
        return 'any';
    };

    return getApproximateUnderlying(a) !== getApproximateUnderlying(b);
};

test('Expression evaluation', () => {
    const actual = [...expressions, ...potentiallyInvalidExpressions]
        .map((e) => {
            let result;
            try {
                result = evaluate(e, scope).toString();
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
                        new UnionExpression([a, evaluate(new UnionExpression([b, c]), scope)]),
                        new UnionExpression([evaluate(new UnionExpression([a, b]), scope), c])
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
                            evaluate(new IntersectionExpression([b, c]), scope),
                        ]),
                        new IntersectionExpression([
                            evaluate(new IntersectionExpression([a, b]), scope),
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
        const actual = orderedPairs(types.filter((t) => t.type !== 'any' && t.type !== 'never'))
            .filter(([a, b]) => !isIncompatibleUnderlyingType(a, b))
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
        for (const a of types) {
            for (const b of types) {
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
                .map((e) => new FunctionCallExpression(name, [e]))
                .map((e) => {
                    let result;
                    try {
                        result = evaluate(e, scope).toString();
                    } catch (error) {
                        result = String(error);
                    }
                    return `${e.toString()} => ${result}`;
                })
                .join('\n');
            expect(actual).toMatchSnapshot();
        });
    };
    const testUnaryString = (name: string) => {
        test(name, () => {
            const actual = [...strings, ...sets]
                .map((e) => new FunctionCallExpression(name, [e]))
                .map((e) => {
                    let result;
                    try {
                        result = evaluate(e, scope).toString();
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
                    .map((args) => new FunctionCallExpression(name, args))
                    .map((e) => {
                        let result;
                        try {
                            result = evaluate(e, scope).toString();
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
                                new FunctionCallExpression(name, [a, b]),
                                new FunctionCallExpression(name, [b, a])
                            );
                        }
                    }
                });
            }

            if (properties.reflexive) {
                test('reflexive', () => {
                    for (const a of numbers) {
                        assertSame(a, new FunctionCallExpression(name, [a, a]));
                    }
                });
            }

            if (properties.associative) {
                test('associative', () => {
                    for (const a of numbers) {
                        for (const b of numbers) {
                            for (const c of numbers) {
                                assertSame(
                                    new FunctionCallExpression(name, [
                                        a,
                                        evaluate(new FunctionCallExpression(name, [b, c]), scope),
                                    ]),
                                    new FunctionCallExpression(name, [
                                        evaluate(new FunctionCallExpression(name, [a, b]), scope),
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

    testUnaryNumber('abs');
    testUnaryNumber('negate');
    testUnaryNumber('round');
    testUnaryNumber('floor');
    testUnaryNumber('reciprocal');

    testUnaryNumber('degToRad');
    testUnaryNumber('sin');
    testUnaryNumber('cos');

    testUnaryNumber('exp');
    testUnaryNumber('log');

    testBinaryNumber('min', { commutative: true, reflexive: true, associative: true });
    testBinaryNumber('add', { commutative: true, reflexive: false, associative: false });
    testBinaryNumber('multiply', { commutative: true, reflexive: false, associative: false });
    testBinaryNumber('mod', { commutative: false, reflexive: false, associative: false });
    testBinaryNumber('pow', { commutative: false, reflexive: false, associative: false });

    testUnaryString('invStrSet');
});

describe('Match', () => {
    // typeName(x) = match x { number => "number", string => "string", null => "null", any => "other" }
    const typeName = (e: Expression) =>
        new MatchExpression(e, [
            new MatchArm(literal(2), undefined, new StringLiteralType('2')),
            new MatchArm(NumberType.instance, undefined, new StringLiteralType('number')),
            new MatchArm(StringType.instance, undefined, new StringLiteralType('string')),
            new MatchArm(new NamedExpression('null'), undefined, new StringLiteralType('null')),
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
                    result = evaluate(e, scope).toString();
                } catch (error) {
                    result = String(error);
                }
                return `${e.toString()} => ${result}`;
            })
            .join('\n');
        expect(actual).toMatchSnapshot();
    });
});
