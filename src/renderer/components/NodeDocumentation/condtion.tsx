import { evaluate } from '@chainner/navi';
import { Code, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { Condition, InputId, NodeSchema, OfKind } from '../../../common/common-types';
import { simplifyCondition } from '../../../common/nodes/condition';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { fromJson } from '../../../common/types/json';
import { prettyPrintType } from '../../../common/types/pretty';
import { isReadonlyArray } from '../../../common/util';

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
const renderPrimitive = (condition: PossiblePrimitive, options: RenderOptions): JSX.Element => {
    const { schema } = options;

    let negated = false;
    if (condition.kind === 'not') {
        negated = true;
        // eslint-disable-next-line no-param-reassign
        condition = condition.condition;
    }

    switch (condition.kind) {
        case 'enum': {
            const inputId = condition.enum;
            const input = schema.inputs.find((i) => i.id === inputId);
            if (!input || input.kind !== 'dropdown') {
                throw new Error(`Invalid input ID: ${inputId}`);
            }
            const valueMap = new Map(input.options.map((o) => [o.value, o.option]));

            const values = isReadonlyArray(condition.values)
                ? condition.values
                : [condition.values];
            const options = values.map((v) => valueMap.get(v) ?? `VALUE:${v}`).sort();

            return (
                <>
                    input <Text as="em">{getInputLabel(schema, condition.enum)}</Text> is set to{' '}
                    <Code>{prettyPrintType(type)}</Code>
                </>
            );
        }
        case 'type': {
            const type = evaluate(fromJson(condition.condition), getChainnerScope());
            return (
                <>
                    input <Text as="em">{getInputLabel(schema, condition.input)}</Text> is
                    {negated && ' not'} of type <Code>{prettyPrintType(type)}</Code>
                </>
            );
        }
        default:
            throw new Error(`Invalid condition kind: ${condition.kind}`);
    }
};
const renderCondition = (condition: Condition, options: RenderOptions): JSX.Element => {
    // Since we want to construct a natural language sentence, we can't just recursively render
    // the condition. Instead, we need to do some analysis of the condition to determine how to
    // render it. We also can't support all possible conditions, but that's okay. Most conditions
    // are simple.
};

interface CEProps {
    condition: Condition;
    schema: NodeSchema;
}
export const ConditionExplanation = memo(({ condition: rawCondition, schema }: CEProps) => {
    const condition = simplifyCondition(rawCondition);

    return <>TODO</>;
});
