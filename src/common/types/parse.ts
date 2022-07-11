import antlr4 from 'antlr4';
import { assertNever, noop } from '../util';
import NaviLexer from './antlr4/NaviLexer';
import NaviParser from './antlr4/NaviParser';
import {
    Expression,
    FieldAccessExpression,
    FunctionCallExpression,
    IntersectionExpression,
    MatchArm,
    MatchExpression,
    NamedExpression,
    NamedExpressionField,
    UnionExpression,
} from './expression';
import {
    AliasDefinition,
    AliasParameterDefinition,
    StructDefinition,
    StructFieldDefinition,
} from './typedef';
import {
    AnyType,
    IntIntervalType,
    IntervalType,
    NeverType,
    NumberType,
    NumericLiteralType,
    StringLiteralType,
    StringType,
} from './types';

type FilterContextName<T extends string> = T extends `${string}Context` ? T : never;
type ContextNames = FilterContextName<keyof typeof NaviParser>;
type Contexts = { [K in ContextNames]: InstanceType<typeof NaviParser[K]> };
type RuleNameOfContext<T extends string> = T extends `${infer Rule}Context` ? Rule : never;
type RuleNames = RuleNameOfContext<ContextNames>;

export class ConversionError extends Error {
    context: antlr4.ParserRuleContext;

    constructor(context: antlr4.ParserRuleContext, message: string) {
        super(`Unable to convert \`${context.getText()}\`: ${message}`);
        this.context = context;
    }
}

const getOptional = <
    T extends antlr4.ParserRuleContext,
    K extends keyof T & Uncapitalize<RuleNames>
>(
    context: T,
    key: K
): Contexts[`${Capitalize<K>}Context`] | undefined => {
    type Result = Contexts[`${Capitalize<K>}Context`];
    const fn = context[key] as unknown as () => Result | null | Result[];
    const result = fn.call(context);
    if (!result) {
        return undefined;
    }
    if (Array.isArray(result)) {
        throw new ConversionError(
            context,
            `Expected there to be a single ${key} rule, but found an array (variable-length) instead.`
        );
    }
    return result;
};
const getRequired = <
    T extends antlr4.ParserRuleContext,
    K extends keyof T & Uncapitalize<RuleNames>
>(
    context: T,
    key: K
): Contexts[`${Capitalize<K>}Context`] => {
    const result = getOptional(context, key);
    if (result === undefined) {
        throw new ConversionError(
            context,
            `Expected there to be a ${key} rule, but found null (optional) instead.`
        );
    }
    return result;
};
const getMultiple = <
    T extends antlr4.ParserRuleContext,
    K extends keyof T & Uncapitalize<RuleNames>
>(
    context: T,
    key: K
): Contexts[`${Capitalize<K>}Context`][] => {
    type Result = Contexts[`${Capitalize<K>}Context`];
    const fn = context[key] as unknown as () => Result | null | Result[];
    const result = fn.call(context);
    if (!Array.isArray(result)) {
        throw new ConversionError(
            context,
            `Expected there to be multiple ${key} rules, but found a single rule instead.`
        );
    }
    return result;
};

interface Token {
    getText(): string;
    toString(): string;
}

const getOptionalToken = <
    T extends antlr4.ParserRuleContext,
    K extends keyof T & Capitalize<keyof T & string>
>(
    context: T,
    key: K
): Token | undefined => {
    const fn = context[key] as unknown as () => Token | null | Token[];
    const result = fn.call(context);
    if (!result) {
        return undefined;
    }
    if (Array.isArray(result)) {
        throw new ConversionError(
            context,
            `Expected there to be a single ${key} token, but found an array (variable-length) instead.`
        );
    }
    return result;
};
const getRequiredToken = <
    T extends antlr4.ParserRuleContext,
    K extends keyof T & Capitalize<keyof T & string>
>(
    context: T,
    key: K
): Token => {
    const result = getOptionalToken(context, key);
    if (result === undefined) {
        throw new ConversionError(
            context,
            `Expected there to be a ${key} token, but found null (optional) instead.`
        );
    }
    return result;
};
const getMultipleTokens = <
    T extends antlr4.ParserRuleContext,
    K extends keyof T & Capitalize<keyof T & string>
>(
    context: T,
    key: K
): Token[] => {
    const fn = context[key] as unknown as () => Token | null | Token[];
    const result = fn.call(context);
    if (!Array.isArray(result)) {
        throw new ConversionError(
            context,
            `Expected there to be multiple ${key} tokens, but found a single token instead.`
        );
    }
    return result;
};

const parseString = (text: string) => new StringLiteralType(JSON.parse(text) as string);
const parseNumber = (text: string) => {
    if (text === 'nan') return new NumericLiteralType(NaN);
    if (text === 'inf') return new NumericLiteralType(Infinity);
    if (text === '-inf') return new NumericLiteralType(-Infinity);
    return new NumericLiteralType(JSON.parse(text) as number);
};
const parseInterval = (text: string) => {
    // e.g. "123.4..4.567e+2"
    const [min, max] = text.split('..');
    return new IntervalType(parseNumber(min).value, parseNumber(max).value);
};
const parseIntInterval = (text: string) => {
    // e.g. "int ( 123..456 )"
    const inner = text.slice(3).trim().slice(1, -1).trim();
    const [min, max] = inner.split('..');
    return new IntIntervalType(parseNumber(min).value, parseNumber(max).value);
};

const argsToExpression = (args: Contexts['ArgsContext']): Expression[] => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return getMultiple(args, 'expression').map(toExpression);
};
const fieldsToList = (
    args: Contexts['FieldsContext']
): (readonly [name: string, expressions: Expression])[] => {
    return getMultiple(args, 'field').map((f) => {
        return [
            getRequiredToken(f, 'Identifier').getText(),
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            toExpression(getRequired(f, 'expression')),
        ] as const;
    });
};

const toExpression = (
    context:
        | Contexts['ExpressionDocumentContext']
        | Contexts['ExpressionContext']
        | Contexts['UnionExpressionContext']
        | Contexts['IntersectionExpressionContext']
        | Contexts['FieldAccessExpressionContext']
        | Contexts['PrimaryExpressionContext']
        | Contexts['FunctionCallContext']
        | Contexts['MatchExpressionContext']
        | Contexts['NamedContext']
): Expression => {
    if (context instanceof NaviParser.ExpressionDocumentContext) {
        return toExpression(getRequired(context, 'expression'));
    }
    if (context instanceof NaviParser.ExpressionContext) {
        return toExpression(getRequired(context, 'unionExpression'));
    }
    if (context instanceof NaviParser.UnionExpressionContext) {
        const items = getMultiple(context, 'intersectionExpression').map(toExpression);
        if (items.length === 1) return items[0];
        return new UnionExpression(items);
    }
    if (context instanceof NaviParser.IntersectionExpressionContext) {
        const items = getMultiple(context, 'fieldAccessExpression').map(toExpression);
        if (items.length === 1) return items[0];
        return new IntersectionExpression(items);
    }
    if (context instanceof NaviParser.FieldAccessExpressionContext) {
        const ofExpression = toExpression(getRequired(context, 'primaryExpression'));
        const fields = getMultipleTokens(context, 'Identifier').map((t) => t.getText());
        return fields.reduce((e, field) => new FieldAccessExpression(e, field), ofExpression);
    }
    if (context instanceof NaviParser.PrimaryExpressionContext) {
        let text = getOptionalToken(context, 'String')?.getText();
        if (text !== undefined) return parseString(text);
        text = getOptionalToken(context, 'Number')?.getText();
        if (text !== undefined) return parseNumber(text);
        text = getOptionalToken(context, 'Interval')?.getText();
        if (text !== undefined) return parseInterval(text);
        text = getOptionalToken(context, 'IntInterval')?.getText();
        if (text !== undefined) return parseIntInterval(text);

        const rule =
            getOptional(context, 'expression') ??
            getOptional(context, 'functionCall') ??
            getOptional(context, 'matchExpression') ??
            getOptional(context, 'named');
        if (!rule) throw new ConversionError(context, `No known rule or token`);
        return toExpression(rule);
    }
    if (context instanceof NaviParser.NamedContext) {
        const name = getRequiredToken(context, 'Identifier').getText();
        const fields = getOptional(context, 'fields');
        if (!fields) {
            if (name === 'any') return AnyType.instance;
            if (name === 'never') return NeverType.instance;
            if (name === 'number') return NumberType.instance;
            if (name === 'string') return StringType.instance;
            return new NamedExpression(name);
        }
        return new NamedExpression(
            name,
            fieldsToList(fields).map(([fieldName, e]) => new NamedExpressionField(fieldName, e))
        );
    }
    if (context instanceof NaviParser.FunctionCallContext) {
        const name = getRequiredToken(context, 'Identifier').getText();
        return new FunctionCallExpression(name, argsToExpression(getRequired(context, 'args')));
    }
    if (context instanceof NaviParser.MatchExpressionContext) {
        const ofExpression = toExpression(getRequired(context, 'expression'));

        return new MatchExpression(
            ofExpression,
            getMultiple(context, 'matchArm').map((a) => {
                const binding = getOptionalToken(a, 'Identifier')?.getText();
                const expressions = getMultiple(a, 'expression');

                if (getOptionalToken(a, 'Discard')) {
                    if (expressions.length !== 1)
                        throw new ConversionError(a, 'Expected a single expression');
                    const [to] = expressions;
                    return new MatchArm(AnyType.instance, binding, toExpression(to));
                }

                if (expressions.length !== 2)
                    throw new ConversionError(a, 'Expected 2 expressions');
                const [pattern, to] = expressions;
                return new MatchArm(toExpression(pattern), binding, toExpression(to));
            })
        );
    }

    return assertNever(context);
};

const errorListener: Parameters<antlr4.Recognizer['addErrorListener']>[0] = {
    syntaxError: (recognizer, offendingSymbol, line, column, msg): void => {
        throw new SyntaxError(`At ${line}:${column}: ${msg}`);
    },
    reportAmbiguity: noop,
    reportAttemptingFullContext: noop,
    reportContextSensitivity: noop,
};
const getParser = (code: string): NaviParser => {
    const chars = new antlr4.InputStream(code);
    const lexer = new NaviLexer(chars);
    lexer.addErrorListener(errorListener);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new NaviParser(tokens);
    parser.addErrorListener(errorListener);
    parser.buildParseTrees = true;
    return parser;
};

export const parseExpression = (code: string): Expression => {
    const parser = getParser(code);
    return toExpression(parser.expressionDocument());
};

export interface Definitions {
    struct: StructDefinition[];
    alias: AliasDefinition[];
}
export const parseDefinitions = (code: string): Definitions => {
    const parser = getParser(code);
    const definitions: Definitions = { alias: [], struct: [] };
    for (const definitionContext of getMultiple(parser.definitionDocument(), 'definition')) {
        const alias = getOptional(definitionContext, 'aliasDefinition');
        if (alias) {
            const name = getRequiredToken(alias, 'Identifier').getText();
            const expression = toExpression(getRequired(alias, 'expression'));
            const fields = getOptional(alias, 'fields');
            if (!fields) {
                definitions.alias.push(new AliasDefinition(name, [], expression));
            } else {
                definitions.alias.push(
                    new AliasDefinition(
                        name,
                        fieldsToList(fields).map(
                            ([fieldName, e]) => new AliasParameterDefinition(fieldName, e)
                        ),
                        expression
                    )
                );
            }
        }

        const struct = getOptional(definitionContext, 'structDefinition');
        if (struct) {
            const name = getRequiredToken(struct, 'Identifier').getText();
            const fields = getOptional(struct, 'fields');
            if (!fields) {
                definitions.struct.push(new StructDefinition(name));
            } else {
                definitions.struct.push(
                    new StructDefinition(
                        name,
                        fieldsToList(fields).map(
                            ([fieldName, e]) => new StructFieldDefinition(fieldName, e)
                        )
                    )
                );
            }
        }
    }
    return definitions;
};
