import {
    ParameterDefinition,
    Scope,
    ScopeBuilder,
    StringType,
    evaluate,
    isStringLiteral,
    isSubsetOf,
} from '@chainner/navi';
import { InputData, KeyInfo, NodeSchema, OfKind } from '../common-types';
import {
    FunctionDefinition,
    FunctionInstance,
    getInputParamName,
    getOutputParamName,
} from '../types/function';
import { fromJson } from '../types/json';
import { lazyKeyed } from '../util';

const getKeyInfoScopeTemplate = lazyKeyed((definition: FunctionDefinition): Scope => {
    const builder = new ScopeBuilder('key info', definition.scope);

    // assign inputs and outputs
    definition.inputDefaults.forEach((input, inputId) => {
        builder.add(new ParameterDefinition(getInputParamName(inputId), input));
    });
    definition.outputDefaults.forEach((output, outputId) => {
        builder.add(new ParameterDefinition(getOutputParamName(outputId), output));
    });

    return builder.createScope();
});
const getKeyInfoScope = (instance: FunctionInstance): Scope => {
    const scope = getKeyInfoScopeTemplate(instance.definition);

    // assign inputs and outputs
    instance.inputs.forEach((input, inputId) => {
        scope.assignParameter(getInputParamName(inputId), input);
    });
    instance.outputs.forEach((output, outputId) => {
        scope.assignParameter(getOutputParamName(outputId), output);
    });

    return scope;
};

const accessors: {
    [kind in KeyInfo['kind']]: (
        info: OfKind<KeyInfo, kind>,
        node: NodeSchema,
        inputData: InputData,
        types: FunctionInstance | undefined
    ) => string | undefined;
} = {
    enum: (info, node, inputData) => {
        const input = node.inputs.find((i) => i.id === info.enum);
        if (!input) throw new Error(`Input ${info.enum} not found`);
        if (input.kind !== 'dropdown') throw new Error(`Input ${info.enum} is not a dropdown`);

        const value = inputData[input.id];
        const option = input.options.find((o) => o.value === value);
        return option?.option;
    },
    type: (info, node, inputData, types) => {
        if (!types) return undefined;

        const expression = fromJson(info.expression);
        const scope = getKeyInfoScope(types);
        const result = evaluate(expression, scope);

        if (isStringLiteral(result)) return result.value;

        // check that the expression actually evaluates to a string
        if (!isSubsetOf(result, StringType.instance)) {
            throw new Error(
                `Key info expression must evaluate to a string, but got ${result.toString()}`
            );
        }

        return undefined;
    },
};

export const getKeyInfo = (
    node: NodeSchema,
    inputData: InputData,
    types: FunctionInstance | undefined
): string | undefined => {
    const { keyInfo } = node;
    if (!keyInfo) return undefined;
    return accessors[keyInfo.kind](keyInfo as never, node, inputData, types);
};
