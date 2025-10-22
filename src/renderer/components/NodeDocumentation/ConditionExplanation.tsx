import { evaluate } from '@chainner/navi';
import { Code, ListItem, Text, UnorderedList } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Condition, InputId, NodeSchema, OfKind } from '../../../common/common-types';
import { simplifyCondition } from '../../../common/nodes/condition';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { explain } from '../../../common/types/explain';
import { fromJson } from '../../../common/types/json';
import { prettyPrintType } from '../../../common/types/pretty';
import { assertNever } from '../../../common/util';
import { DropDownOptions } from './DropDownOptions';

type PossiblePrimitive = OfKind<Condition, Exclude<Condition['kind'], 'and' | 'or'>>;
const isPossiblePrimitive = (condition: Condition): condition is PossiblePrimitive => {
    return condition.kind !== 'and' && condition.kind !== 'or';
};

const getInputLabel = (schema: NodeSchema, inputId: InputId): string => {
    const input = schema.inputs.find((i) => i.id === inputId);
    if (!input) {
        return `ID:${inputId}`;
    }
    return input.label;
};

interface RenderOptions {
    readonly schema: NodeSchema;
}
const renderPrimitive = (
    condition: PossiblePrimitive,
    options: RenderOptions,
    t: (key: string, defaultValue?: string) => string
): JSX.Element => {
    const { schema } = options;

    let negated = false;
    if (condition.kind === 'not') {
        negated = true;

        const inner = condition.condition;
        if (inner.kind === 'not' || inner.kind === 'and' || inner.kind === 'or') {
            throw new Error(`The condition has not be simplified correctly.`);
        }
        // eslint-disable-next-line no-param-reassign
        condition = inner;
    }

    switch (condition.kind) {
        case 'enum': {
            const inputId = condition.enum;
            const input = schema.inputs.find((i) => i.id === inputId);
            if (!input || input.kind !== 'dropdown') {
                throw new Error(`Invalid input ID: ${inputId}`);
            }

            const { values } = condition;
            const valueOptions = input.options.filter((o) => values.includes(o.value));

            return (
                <>
                    <Text
                        as="span"
                        fontWeight="600"
                        userSelect="text"
                    >
                        {getInputLabel(schema, condition.enum)}
                    </Text>{' '}
                    {negated
                        ? t('nodeDocumentation.conditionExplanation.isNot')
                        : t('nodeDocumentation.conditionExplanation.is')}
                    {valueOptions.length === 1
                        ? ''
                        : ` ${t('nodeDocumentation.conditionExplanation.oneOf')} `}
                    <DropDownOptions options={valueOptions} />
                </>
            );
        }
        case 'type': {
            const prefix = (
                <>
                    <Text
                        as="span"
                        fontWeight="600"
                        userSelect="text"
                    >
                        {getInputLabel(schema, condition.input)}
                    </Text>
                    {negated ? ' is not' : ' is'}
                </>
            );

            const type = evaluate(fromJson(condition.condition), getChainnerScope());
            const simple = explain(type, { strictUnion: true });
            if (simple) {
                return (
                    <>
                        {prefix} {simple}
                    </>
                );
            }

            return (
                <>
                    {prefix} {t('nodeDocumentation.conditionExplanation.ofType')}{' '}
                    <Code
                        display="inline"
                        userSelect="text"
                        whiteSpace="pre-line"
                    >
                        {prettyPrintType(type, { omitDefaultFields: true })}
                    </Code>
                </>
            );
        }
        default:
            return assertNever(condition);
    }
};
const renderCondition = (
    condition: Condition,
    prefix: JSX.Element | undefined,
    options: RenderOptions,
    t: (key: string, defaultValue?: string) => string
): JSX.Element => {
    // Since we want to construct a natural language sentence, we can't just recursively render
    // the condition. Instead, we need to do some analysis of the condition to determine how to
    // render it. We also can't support all possible conditions, but that's okay. Most conditions
    // are simple.

    if (isPossiblePrimitive(condition)) {
        return (
            <Text
                fontSize="md"
                userSelect="text"
            >
                {prefix}
                {renderPrimitive(condition, options, t)}.
            </Text>
        );
    }

    return (
        <>
            <Text
                fontSize="md"
                userSelect="text"
            >
                {prefix}
                {condition.kind === 'and'
                    ? t('nodeDocumentation.conditionExplanation.allOf')
                    : t('nodeDocumentation.conditionExplanation.atLeastOneOf')}{' '}
                {t('nodeDocumentation.conditionExplanation.followingConditions')}
            </Text>
            <UnorderedList
                alignItems="left"
                ml={0}
                pl={8}
                textAlign="left"
                w="full"
            >
                {condition.items.map((inner, i) => {
                    return (
                        <ListItem
                            // eslint-disable-next-line react/no-array-index-key
                            key={i}
                            userSelect="text"
                        >
                            {renderCondition(inner, undefined, options, t)}
                        </ListItem>
                    );
                })}
            </UnorderedList>
        </>
    );
};

interface CEProps {
    condition: Condition;
    schema: NodeSchema;
}
// eslint-disable-next-line react/prop-types
export const ConditionExplanation = memo(({ condition, schema }: CEProps) => {
    const { t } = useTranslation();
    return renderCondition(
        simplifyCondition(condition),
        <Text
            as="i"
            pr={1}
        >
            {t('nodeDocumentation.conditionExplanation.condition')}
        </Text>,
        { schema },
        t
    );
});
