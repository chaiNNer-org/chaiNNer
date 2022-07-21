import { parseExpression } from '../../../src/common/types/parse';
import { SourceDocument } from '../../../src/common/types/source';

const expressionSnippets: string[] = [
    // comments and spaces
    String.raw`/* some comment */ 0 // another comment
    // and another`,

    // numbers
    String.raw`0`,
    String.raw`123`,
    String.raw`-123`,
    String.raw`-123e45`,
    String.raw`-123E+45`,
    String.raw`123e-45`,
    String.raw`123.456e-45`,
    String.raw`-123.456E-45`,
    String.raw`nan`,
    String.raw`inf`,
    String.raw`-inf`,

    // intervals
    String.raw`1..2`,
    String.raw`1..2.5`,
    String.raw`1e2..2.5e4`,
    String.raw`-inf..inf`,
    String.raw`-inf..0`,
    String.raw`..`,
    String.raw`..0`,
    String.raw`1..`,

    // int intervals
    String.raw`int(1..2)`,
    String.raw`  int   (   1..2   )  `,
    String.raw`int(1e2..2.5e4)`,
    String.raw`int(-inf..inf)`,
    String.raw`int(-inf..0)`,
    String.raw`int(..)`,
    String.raw`int(..0)`,
    String.raw`int(1..)`,

    // strings
    String.raw`""`,
    String.raw`"foo"`,
    String.raw`"foo\r\n\""`,

    // function call
    String.raw`foo()`,
    String.raw`foo(1)`,
    String.raw`foo(1, )`,
    String.raw`foo(1, 2)`,
    String.raw`foo(1, 2,)`,
    String.raw`foo (  1  , 2  )`,
    String.raw`any()`,
    String.raw`never()`,
    String.raw`number()`,
    String.raw`string()`,
    String.raw`int()`,
    String.raw`uint()`,

    // named
    String.raw`null`,
    String.raw`foo`,
    String.raw`foo {}`,
    String.raw`foo { foo: 3 }`,
    String.raw`foo { foo: uint }`,
    String.raw`Image { width: uint, height: uint, channels: int(1..inf) }`,
    String.raw`bar { any: any, never: never, number: number, string: string }`,

    // match
    String.raw`match never {}`,
    String.raw`match (a) {}`,
    String.raw`match a|b {}`,
    String.raw`match a {}`,
    String.raw`match a {} {}`,
    String.raw`match a { foo: uint } { number => 1 }`,
    String.raw`match a { number => 1, }`,
    String.raw`match a { number => 1, string => 2, any => 5 }`,
    String.raw`match a { number => 1, string => 2, _ => 5 }`,
    String.raw`match a { _ => 234, number => 1, string => 2, _ => 5 }`,
    String.raw`match a {  number as foo => add(foo, 1), _ as foo => foo, }`,
    String.raw`match a { 1 | 2 as foo => add(foo, 1), "bar" => "baz", _ as foo => foo, }`,

    // field access
    String.raw`a.b.c.d.e.f`,
    String.raw`foo { foo: uint }.foo`,

    // intersection and union
    String.raw`a | b | c | d`,
    String.raw`a & b & c & d`,
    String.raw`a & b | c & d`,

    // scope
    String.raw`{ 0 }`,
    String.raw`{ let foo = 0; foo }`,
    String.raw`{ def getFoo() = 0; getFoo() }`,
    String.raw`{ def getFoo() { 0 } getFoo() }`,
    String.raw`{ struct Foo { bar: 0 } Foo.bar }`,

    // definitions

    // struct
    String.raw`struct false; false`,
    String.raw`struct Image { width: uint, height: uint, channels: int(1..) } Image`,

    // let
    String.raw`let bool = true | false; bool`,

    // enum
    String.raw`enum Direction { North, East, South, West } Direction`,

    // def
    String.raw`def inc(a: number) = add(a, 1); inc(0)`,
];
const invalidExpressionSnippets: string[] = [
    String.raw``,

    // numbers
    String.raw`öäü0`,
    String.raw`+0`,
    String.raw`+123`,
    String.raw`.2e4`,
    String.raw`2.`,
    String.raw`+inf`,

    // intervals
    String.raw`1..1`,
    String.raw`2..1`,
    String.raw`-inf..nan`,
    String.raw`nan..nan`,

    // int intervals
    String.raw`int(1..2.5)`,
    String.raw`int(1..1)`,
    String.raw`int(2..1)`,
    String.raw`int(-inf..nan)`,
    String.raw`int(nan..nan)`,

    // strings
    String.raw`"""`,
    String.raw`"\g"`,
    String.raw`"
    "`,

    // function call
    String.raw`as()`,
    String.raw`match()`,
    String.raw`struct()`,
    String.raw`let()`,
    String.raw`def()`,

    // named
    String.raw`match { }`,
    String.raw`as { }`,
    String.raw`struct { }`,
    String.raw`def { }`,
    String.raw`let { }`,
    String.raw`foo { as: as }`,

    // match
    String.raw`match a`,
    String.raw`match a { foo: uint }`,

    // field access
    String.raw`a.match`,
    String.raw`a.as`,
    String.raw`a.def`,
    String.raw`a.let`,
    String.raw`a.struct`,
    String.raw`a.1`,
    String.raw`a.b.(c.d).e.f`,
    String.raw`a.`,

    // intersection and union
    String.raw`a | b |`,
    String.raw`a & b &`,
    String.raw`| b`,
    String.raw`& b`,
];

const expressionParsing = (expr: string): string => {
    let result: string;
    try {
        result = parseExpression(new SourceDocument(expr, 'test document')).toString();
    } catch (error) {
        result = String(error);
    }
    return `>>> ${expr}\n${result}`;
};

test('Expression parsing', () => {
    const results = expressionSnippets.map(expressionParsing);
    expect(results.join('\n\n')).toMatchSnapshot();
});

test('Invalid expression parsing', () => {
    const results = invalidExpressionSnippets.map(expressionParsing);
    expect(results.join('\n\n')).toMatchSnapshot();
});
