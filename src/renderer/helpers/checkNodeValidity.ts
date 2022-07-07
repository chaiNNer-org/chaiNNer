import { Edge } from 'react-flow-renderer';
import { EdgeData, InputData, NodeSchema } from '../../common/common-types';
import { evaluate } from '../../common/types/evaluate';
import { IntersectionExpression, NamedExpression } from '../../common/types/expression';
import { FunctionInstance } from '../../common/types/function';
import { TypeDefinitions } from '../../common/types/typedef';
import { parseHandle } from '../../common/util';

export type Validity =
    | { readonly isValid: true }
    | { readonly isValid: false; readonly reason: string };

export const VALID: Validity = { isValid: true };

export interface CheckNodeValidityOptions {
    id: string;
    schema: NodeSchema;
    inputData: InputData;
    edges: readonly Edge<EdgeData>[];
    functionInstance: FunctionInstance | undefined;
    typeDefinitions: TypeDefinitions;
}
export const checkNodeValidity = ({
    id,
    schema,
    inputData,
    edges,
    functionInstance,
    typeDefinitions,
}: CheckNodeValidityOptions): Validity => {
    const targetedInputs = edges
        .filter((e) => e.target === id && e.targetHandle)
        .map((e) => parseHandle(e.targetHandle!).inOutId);

    const missingInputs = schema.inputs.filter((input) => {
        // optional inputs can't be missing
        if (input.optional) return false;

        const inputValue = inputData[input.id];
        // a value is assigned
        if (inputValue !== undefined && inputValue !== '') return false;

        // the value of the input is assigned by an edge
        if (targetedInputs.includes(input.id)) return false;

        return true;
    });

    if (missingInputs.length) {
        return {
            isValid: false,
            reason: `Missing required input data: ${missingInputs
                .map((input) => input.label)
                .join(', ')}`,
        };
    }
    return VALID;
};
