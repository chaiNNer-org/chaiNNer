import antlr4 from 'antlr4';
import { assertNever, noop } from '../util';
import NaviLexer from './antlr4/NaviLexer';
import NaviParser from './antlr4/NaviParser';
import {
    Definition,
    Expression,
    FieldAccessExpression,
    FunctionCallExpression,
    FunctionDefinition,
    FunctionDefinitionParameter,
    IntersectionExpression,
    MatchArm,
    MatchExpression,
    NamedExpression,
    NamedExpressionField,
    ScopeExpression,
    StructDefinition,
    StructDefinitionField,
    UnionExpression,
    VariableDefinition,
} from './expression';
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

const parseStringType = (text: string) => new StringLiteralType(JSON.parse(text) as string);
const parseNumber = (text: string): number => {
    if (text === 'nan') return NaN;
    if (text === 'inf') return Infinity;
    if (text === '-inf') return -Infinity;
    return JSON.parse(text) as number;
};
const parseNumberType = (text: string) => new NumericLiteralType(parseNumber(text));
const parseInterval = (text: string): [min: number, max: number] => {
    // e.g. "123.4..4.567e+2"
    const [min, max] = text.split('..');
    return [parseNumber(min || '-inf'), parseNumber(max || 'inf')];
};
const parseIntervalType = (text: string) => new IntervalType(...parseInterval(text));
const parseIntIntervalType = (text: string) => {
    const inner = text.slice(3).trim().slice(1, -1).trim();
    return new IntIntervalType(...parseInterval(inner));
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
const parametersToList = (
    args: Contexts['ParametersContext']
): (readonly [name: string, expressions: Expression])[] => {
    return getMultiple(args, 'parameter').map((f) => {
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
        | Contexts['ScopeExpressionContext']
): Expression => {
    if (
        context instanceof NaviParser.ExpressionDocumentContext ||
        context instanceof NaviParser.ScopeExpressionContext
    ) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const definitions = getMultiple(context, 'definition').map(toDefinition);
        const expression = toExpression(getRequired(context, 'expression'));
        if (definitions.length === 0) return expression;
        return new ScopeExpression(definitions, expression);
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
        if (text !== undefined) return parseStringType(text);
        text = getOptionalToken(context, 'Number')?.getText();
        if (text !== undefined) return parseNumberType(text);
        text = getOptionalToken(context, 'Interval')?.getText();
        if (text !== undefined) return parseIntervalType(text);
        text = getOptionalToken(context, 'IntInterval')?.getText();
        if (text !== undefined) return parseIntIntervalType(text);

        const rule =
            getOptional(context, 'expression') ??
            getOptional(context, 'scopeExpression') ??
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
const toDefinition = (
    context:
        | Contexts['DefinitionContext']
        | Contexts['StructDefinitionContext']
        | Contexts['FunctionDefinitionContext']
        | Contexts['VariableDefinitionContext']
): Definition => {
    if (context instanceof NaviParser.DefinitionContext) {
        const rule =
            getOptional(context, 'structDefinition') ??
            getOptional(context, 'functionDefinition') ??
            getOptional(context, 'variableDefinition');
        if (!rule) throw new ConversionError(context, `No known rule or token`);
        return toDefinition(rule);
    }
    if (context instanceof NaviParser.StructDefinitionContext) {
        const name = getRequiredToken(context, 'Identifier').getText();
        const fields = getOptional(context, 'fields');
        if (!fields) return new StructDefinition(name);
        return new StructDefinition(
            name,
            fieldsToList(fields).map(
                ([fieldName, type]) => new StructDefinitionField(fieldName, type)
            )
        );
    }
    if (context instanceof NaviParser.FunctionDefinitionContext) {
        const name = getRequiredToken(context, 'Identifier').getText();
        const parameters = parametersToList(getRequired(context, 'parameters'));
        const rule = getOptional(context, 'expression') ?? getOptional(context, 'scopeExpression');
        if (!rule) throw new ConversionError(context, `No known rule or token`);
        return new FunctionDefinition(
            name,
            parameters.map(
                ([parameterName, type]) => new FunctionDefinitionParameter(parameterName, type)
            ),
            toExpression(rule)
        );
    }
    if (context instanceof NaviParser.VariableDefinitionContext) {
        const name = getRequiredToken(context, 'Identifier').getText();
        const value = toExpression(getRequired(context, 'expression'));
        return new VariableDefinition(name, value);
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
export const parseDefinitions = (code: string): Definition[] => {
    const parser = getParser(code);
    const definitions: Definition[] = [];
    for (const definitionContext of getMultiple(parser.definitionDocument(), 'definition')) {
        definitions.push(toDefinition(definitionContext));
    }
    return definitions;
};
