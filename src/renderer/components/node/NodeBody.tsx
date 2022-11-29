import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import { Input, InputData, InputSize, NodeSchema } from '../../../common/common-types';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

const isAutoInput = (input: Input): boolean =>
    input.kind === 'generic' && input.optional && !input.hasHandle;

interface NodeBodyProps {
    id: string;
    inputData: InputData;
    inputSize?: InputSize;
    isLocked?: boolean;
    schema: NodeSchema;
    animated?: boolean;
}

export const NodeBody = memo(
    ({ schema, id, inputData, inputSize, isLocked, animated = false }: NodeBodyProps) => {
        const { inputs, outputs, schemaId } = schema;

        const autoInput = inputs.length === 1 && isAutoInput(inputs[0]);

        return (
            <>
                {!autoInput && (
                    <NodeInputs
                        id={id}
                        inputData={inputData}
                        inputSize={inputSize}
                        isLocked={isLocked}
                        schema={schema}
                    />
                )}

                {!autoInput && outputs.length > 0 && <Box />}
                <NodeOutputs
                    animated={animated}
                    id={id}
                    outputs={outputs}
                    schemaId={schemaId}
                />
            </>
        );
    }
);
