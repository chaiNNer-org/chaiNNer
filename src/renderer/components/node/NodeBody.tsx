import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import {
    InputData,
    InputId,
    InputSize,
    InputValue,
    NodeSchema,
} from '../../../common/common-types';
import { isAutoInput } from '../../../common/util';
import { NodeInputs } from './NodeInputs';
import { NodeOutputs } from './NodeOutputs';

interface NodeBodyProps {
    id: string;
    inputData: InputData;
    inputSize?: InputSize;
    setInputValue: (inputId: InputId, value: InputValue) => void;
    isLocked?: boolean;
    schema: NodeSchema;
    animated?: boolean;
}

export const NodeBody = memo(
    ({
        schema,
        id,
        inputData,
        setInputValue,
        inputSize,
        isLocked,
        animated = false,
    }: NodeBodyProps) => {
        const { inputs, outputs, schemaId } = schema;

        const autoInput = inputs.length === 1 && isAutoInput(inputs[0]);

        return (
            <>
                {!autoInput && inputs.length > 0 && <Box py={1} />}
                {!autoInput && (
                    <Box
                        bg="var(--bg-700)"
                        w="full"
                    >
                        <NodeInputs
                            id={id}
                            inputData={inputData}
                            inputSize={inputSize}
                            isLocked={isLocked}
                            schema={schema}
                            setInputValue={setInputValue}
                        />
                    </Box>
                )}

                {outputs.length > 0 && <Box py={1} />}
                <Box
                    bg="var(--bg-700)"
                    w="full"
                >
                    <NodeOutputs
                        animated={animated}
                        id={id}
                        outputs={outputs}
                        schemaId={schemaId}
                    />
                </Box>
            </>
        );
    }
);
