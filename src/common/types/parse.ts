/* eslint-disable max-classes-per-file */
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
import { Source, SourceDocument } from './source';
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

class AstConverter {
    readonly document: SourceDocument;

    constructor(document: SourceDocument) {
        this.document = document;
    }

    private getSource(context: antlr4.ParserRuleContext): Source {
        const interval = context.getSourceInterval();
        return {
            document: this.document,
            span: [interval.start, interval.start + interval.length],
        };
    }

    private argsToExpression(args: Contexts['ArgsContext']): Expression[] {
        return getMultiple(args, 'expression').map((e) => this.toExpression(e));
    }

    private fieldsToList(
        args: Contexts['FieldsContext']
    ): (readonly [name: string, expressions: Expression])[] {
        return getMultiple(args, 'field').map((f) => {
            return [
                getRequiredToken(f, 'Identifier').getText(),

                this.toExpression(getRequired(f, 'expression')),
            ] as const;
        });
    }

    private parametersToList(
        args: Contexts['ParametersContext']
    ): (readonly [name: string, expressions: Expression])[] {
        return getMultiple(args, 'parameter').map((f) => {
            return [
                getRequiredToken(f, 'Identifier').getText(),

                this.toExpression(getRequired(f, 'expression')),
            ] as const;
        });
    }

    toExpression(context: Parameters<AstConverter['toExpressionWithoutSource']>[0]): Expression {
        const expression = this.toExpressionWithoutSource(context);
        // can't add source info to types
        if (expression.underlying !== 'expression') return expression;
        // already has source info
        if (expression.source) return expression;

        expression.source = this.getSource(context);
        return expression;
    }

    private toExpressionWithoutSource(
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
    ): Expression {
        if (
            context instanceof NaviParser.ExpressionDocumentContext ||
            context instanceof NaviParser.ScopeExpressionContext
        ) {
            const definitions = getMultiple(context, 'definition').map((d) => this.toDefinition(d));
            const expression = this.toExpression(getRequired(context, 'expression'));
            if (definitions.length === 0) return expression;
            return new ScopeExpression(definitions, expression);
        }
        if (context instanceof NaviParser.ExpressionContext) {
            return this.toExpression(getRequired(context, 'unionExpression'));
        }
        if (context instanceof NaviParser.UnionExpressionContext) {
            const items = getMultiple(context, 'intersectionExpression').map((e) =>
                this.toExpression(e)
            );
            if (items.length === 1) return items[0];
            return new UnionExpression(items);
        }
        if (context instanceof NaviParser.IntersectionExpressionContext) {
            const items = getMultiple(context, 'fieldAccessExpression').map((e) =>
                this.toExpression(e)
            );
            if (items.length === 1) return items[0];
            return new IntersectionExpression(items);
        }
        if (context instanceof NaviParser.FieldAccessExpressionContext) {
            const ofExpression = this.toExpression(getRequired(context, 'primaryExpression'));
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
            return this.toExpression(rule);
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
                this.fieldsToList(fields).map(
                    ([fieldName, e]) => new NamedExpressionField(fieldName, e)
                )
            );
        }
        if (context instanceof NaviParser.FunctionCallContext) {
            const name = getRequiredToken(context, 'Identifier').getText();
            return new FunctionCallExpression(
                name,
                this.argsToExpression(getRequired(context, 'args'))
            );
        }
        if (context instanceof NaviParser.MatchExpressionContext) {
            const ofExpression = this.toExpression(getRequired(context, 'expression'));

            return new MatchExpression(
                ofExpression,
                getMultiple(context, 'matchArm').map((a) => {
                    const binding = getOptionalToken(a, 'Identifier')?.getText();
                    const expressions = getMultiple(a, 'expression');

                    if (getOptionalToken(a, 'Discard')) {
                        if (expressions.length !== 1)
                            throw new ConversionError(a, 'Expected a single expression');
                        const [to] = expressions;
                        return new MatchArm(AnyType.instance, binding, this.toExpression(to));
                    }

                    if (expressions.length !== 2)
                        throw new ConversionError(a, 'Expected 2 expressions');
                    const [pattern, to] = expressions;
                    return new MatchArm(this.toExpression(pattern), binding, this.toExpression(to));
                })
            );
        }

        return assertNever(context);
    }

    toDefinition(context: Parameters<AstConverter['toDefinitionWithoutSource']>[0]): Definition {
        const definition = this.toDefinitionWithoutSource(context);
        // already has source info
        if (definition.source) return definition;

        definition.source = this.getSource(context);
        return definition;
    }

    private toDefinitionWithoutSource(
        context:
            | Contexts['DefinitionContext']
            | Contexts['StructDefinitionContext']
            | Contexts['FunctionDefinitionContext']
            | Contexts['VariableDefinitionContext']
    ): Definition {
        if (context instanceof NaviParser.DefinitionContext) {
            const rule =
                getOptional(context, 'structDefinition') ??
                getOptional(context, 'functionDefinition') ??
                getOptional(context, 'variableDefinition');
            if (!rule) throw new ConversionError(context, `No known rule or token`);
            return this.toDefinition(rule);
        }
        if (context instanceof NaviParser.StructDefinitionContext) {
            const name = getRequiredToken(context, 'Identifier').getText();
            const fields = getOptional(context, 'fields');
            if (!fields) return new StructDefinition(name);
            return new StructDefinition(
                name,
                this.fieldsToList(fields).map(
                    ([fieldName, type]) => new StructDefinitionField(fieldName, type)
                )
            );
        }
        if (context instanceof NaviParser.FunctionDefinitionContext) {
            const name = getRequiredToken(context, 'Identifier').getText();
            const parameters = this.parametersToList(getRequired(context, 'parameters'));
            const rule =
                getOptional(context, 'expression') ?? getOptional(context, 'scopeExpression');
            if (!rule) throw new ConversionError(context, `No known rule or token`);
            return new FunctionDefinition(
                name,
                parameters.map(
                    ([parameterName, type]) => new FunctionDefinitionParameter(parameterName, type)
                ),
                this.toExpression(rule)
            );
        }
        if (context instanceof NaviParser.VariableDefinitionContext) {
            const name = getRequiredToken(context, 'Identifier').getText();
            const value = this.toExpression(getRequired(context, 'expression'));
            return new VariableDefinition(name, value);
        }

        return assertNever(context);
    }
}

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

export const parseExpression = (document: SourceDocument): Expression => {
    const parser = getParser(document.text);
    return new AstConverter(document).toExpression(parser.expressionDocument());
};
export const parseDefinitions = (document: SourceDocument): Definition[] => {
    const parser = getParser(document.text);
    const converter = new AstConverter(document);
    const definitions: Definition[] = [];
    for (const definitionContext of getMultiple(parser.definitionDocument(), 'definition')) {
        definitions.push(converter.toDefinition(definitionContext));
    }
    return definitions;
};
