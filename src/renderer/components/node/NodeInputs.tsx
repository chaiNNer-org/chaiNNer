import { memo } from 'react';
import { InputData, InputSize, NodeSchema } from '../../../common/common-types';
import { SchemaInput } from '../inputs/SchemaInput';

interface NodeInputsProps {
    schema: NodeSchema;
    id: string;
    inputData: InputData;
    inputSize?: InputSize;
    isLocked?: boolean;
}

export const NodeInputs = memo(
    ({ schema, id, inputData, inputSize, isLocked }: NodeInputsProps) => {
        const { inputs, schemaId } = schema;

        return (
            <>
                {inputs.map((input) => (
                    <SchemaInput
                        input={input}
                        inputData={inputData}
                        inputSize={inputSize}
                        isLocked={isLocked ?? false}
                        key={input.id}
                        nodeId={id}
                        schemaId={schemaId}
                    />
                ))}
            </>
        );
    }
);
