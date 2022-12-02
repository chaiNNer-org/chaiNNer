import { memo } from 'react';
import { useContext } from 'use-context-selector';
import { InputData, InputSize, NodeSchema } from '../../../common/common-types';
import { assertNever } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GroupElement } from '../groups/Group';
import { SchemaInput } from '../inputs/SchemaInput';

interface NodeInputsProps {
    schema: NodeSchema;
    id: string;
    inputData: InputData;
    inputSize?: InputSize;
    isLocked?: boolean;
}

export const NodeInputs = memo(
    ({ schema, id, inputData, inputSize, isLocked = false }: NodeInputsProps) => {
        const { schemaInputs } = useContext(BackendContext);

        const { schemaId } = schema;
        const inputs = schemaInputs.get(schemaId);

        return (
            <>
                {inputs.map((item) => {
                    switch (item.kind) {
                        case 'input': {
                            const { input } = item;
                            return (
                                <SchemaInput
                                    input={input}
                                    inputData={inputData}
                                    inputSize={inputSize}
                                    isLocked={isLocked}
                                    key={`i${input.id}`}
                                    nodeId={id}
                                    schemaId={schemaId}
                                />
                            );
                        }
                        case 'group': {
                            const { group } = item;
                            return (
                                <GroupElement
                                    group={group}
                                    inputData={inputData}
                                    inputSize={inputSize}
                                    inputs={item.inputs}
                                    isLocked={isLocked}
                                    key={`g${group.id}`}
                                    nodeId={id}
                                    schemaId={schemaId}
                                />
                            );
                        }
                        default:
                            return assertNever(item);
                    }
                })}
            </>
        );
    }
);
