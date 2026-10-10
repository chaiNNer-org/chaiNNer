import { evaluate } from '@chainner/navi';
import { Code, ListItem, Text, UnorderedList } from '@chakra-ui/react';
import i18n from 'i18next';
import { memo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Condition, InputId, NodeSchema, OfKind } from '../../../common/common-types';
import { simplifyCondition } from '../../../common/nodes/condition';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { explain } from '../../../common/types/explain';
import { fromJson } from '../../../common/types/json';
import { prettyPrintType } from '../../../common/types/pretty';
import { assertNever } from '../../../common/util';
import { TransElement } from '../TransElement';
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

// Whole sentences, so each language can order the input name, the options
// and the verb its own way. Each ends with its own punctuation.
const SENTENCES = {
    enumIs: '<name>{{name}}</name> is <options/>.',
    enumIsNot: '<name>{{name}}</name> is not <options/>.',
    enumIsOneOf: '<name>{{name}}</name> is one of <options/>.',
    enumIsNotOneOf: '<name>{{name}}</name> is not one of <options/>.',
    typeIs: '<name>{{name}}</name> is {{type}}.',
    typeIsNot: '<name>{{name}}</name> is not {{type}}.',
    typeIsOfType: '<name>{{name}}</name> is of type <type/>.',
    typeIsNotOfType: '<name>{{name}}</name> is not of type <type/>.',
} as const;

const InputName = (
    <Text
        as="span"
        fontWeight="600"
        userSelect="text"
    />
);

interface SentenceProps {
    sentence: keyof typeof SENTENCES;
    name: string;
    type?: string;
    components?: Record<string, JSX.Element>;
}
const Sentence = memo(({ sentence, name, type, components }: SentenceProps) => {
    // Passing the hook's t makes this re-render when the language changes;
    // Trans on its own doesn't.
    const { t } = useTranslation();
    return (
        <Trans
            components={{ name: InputName, ...components }}
            defaults={SENTENCES[sentence]}
            i18nKey={`nodeDocumentation.conditionExplanation.${sentence}`}
            t={t}
            values={{ name, type }}
        />
    );
});

const renderPrimitive = (condition: PossiblePrimitive, options: RenderOptions): JSX.Element => {
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
            const single = valueOptions.length === 1;
            let sentence: keyof typeof SENTENCES;
            if (negated) {
                sentence = single ? 'enumIsNot' : 'enumIsNotOneOf';
            } else {
                sentence = single ? 'enumIs' : 'enumIsOneOf';
            }

            return (
                <Sentence
                    components={{
                        options: (
                            <TransElement element={<DropDownOptions options={valueOptions} />} />
                        ),
                    }}
                    name={getInputLabel(schema, condition.enum)}
                    sentence={sentence}
                />
            );
        }
        case 'type': {
            const name = getInputLabel(schema, condition.input);
            const type = evaluate(fromJson(condition.condition), getChainnerScope());
            const simple = explain(type, { strictUnion: true });
            if (simple) {
                return (
                    <Sentence
                        name={name}
                        sentence={negated ? 'typeIsNot' : 'typeIs'}
                        type={simple}
                    />
                );
            }

            return (
                <Sentence
                    components={{
                        type: (
                            <TransElement
                                element={
                                    <Code
                                        display="inline"
                                        userSelect="text"
                                        whiteSpace="pre-line"
                                    >
                                        {prettyPrintType(type, { omitDefaultFields: true })}
                                    </Code>
                                }
                            />
                        ),
                    }}
                    name={name}
                    sentence={negated ? 'typeIsNotOfType' : 'typeIsOfType'}
                />
            );
        }
        default:
            return assertNever(condition);
    }
};
const renderCondition = (
    condition: Condition,
    prefix: JSX.Element | undefined,
    options: RenderOptions
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
                {renderPrimitive(condition, options)}
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
                    ? i18n.t(
                          'nodeDocumentation.conditionExplanation.allConditions',
                          'All of the following conditions must be met:'
                      )
                    : i18n.t(
                          'nodeDocumentation.conditionExplanation.anyCondition',
                          'At least one of the following conditions must be met:'
                      )}
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
                            {renderCondition(inner, undefined, options)}
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
        { schema }
    );
});
