import { memo } from 'react';
import { SchemaInput } from '../inputs/SchemaInput';
import { GroupProps } from './props';

export const FromToDropdownsGroup = memo(
    ({
        inputs,
        inputData,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
    }: GroupProps<'from-to-dropdowns'>) => {
        const [from, to] = inputs;

        return (
            <>
                <SchemaInput
                    input={from}
                    inputData={inputData}
                    inputSize={inputSize}
                    isLocked={isLocked}
                    nodeId={nodeId}
                    schemaId={schemaId}
                />
                <SchemaInput
                    input={to}
                    inputData={inputData}
                    inputSize={inputSize}
                    isLocked={isLocked}
                    nodeId={nodeId}
                    schemaId={schemaId}
                />
            </>
        );
    }
);
