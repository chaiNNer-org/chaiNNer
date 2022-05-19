import { Edge } from 'react-flow-renderer';
import { EdgeData, Input, InputData } from '../../common/common-types';
import { parseHandle } from '../../common/util';

const checkNodeValidity = ({
    id,
    inputs,
    inputData,
    edges,
}: {
    id: string;
    inputs: Input[];
    inputData: InputData;
    edges: readonly Edge<EdgeData>[];
}): [boolean, string] => {
    const targetedInputs = edges
        .filter((e) => e.target === id && e.targetHandle)
        .map((e) => parseHandle(e.targetHandle!).index);

    const missingInputs = inputs.filter((input, index) => {
        // optional inputs can't be missing
        if (input.optional) return false;

        const inputValue = inputData[index];
        // a value is assigned
        if (inputValue !== undefined && inputValue !== '') return false;

        // the value of the input is assigned by an edge
        if (targetedInputs.includes(index)) return false;

        return true;
    });

    if (missingInputs.length) {
        return [
            false,
            `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`,
        ];
    }
    return [true, ''];
};

export default checkNodeValidity;
