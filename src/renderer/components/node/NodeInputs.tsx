/* eslint-disable react/prop-types */
import { memo } from 'react';
import { useContext } from 'use-context-selector';
import {
    InputData,
    InputId,
    InputSize,
    InputValue,
    NodeSchema,
} from '../../../common/common-types';
import { getUniqueKey } from '../../../common/group-inputs';
import { BackendContext } from '../../contexts/BackendContext';
import { GroupElement } from '../groups/Group';
import { InputItemRenderer } from '../groups/props';
import { SchemaInput } from '../inputs/SchemaInput';

interface NodeInputsProps {
    schema: NodeSchema;
    id: string;
    inputData: InputData;
    setInputValue: (inputId: InputId, value: InputValue) => void;
    inputSize?: InputSize;
    isLocked?: boolean;
}

const ItemRenderer: InputItemRenderer = memo(
    ({ item, inputData, setInputValue, inputSize, isLocked, nodeId, schemaId }) => {
        if (item.kind === 'group') {
            const { group } = item;
            return (
                <GroupElement
                    ItemRenderer={ItemRenderer}
                    group={group}
                    inputData={inputData}
                    inputSize={inputSize}
                    inputs={item.inputs}
                    isLocked={isLocked}
                    nodeId={nodeId}
                    schemaId={schemaId}
                    setInputValue={setInputValue}
                />
            );
        }

        return (
            <SchemaInput
                input={item}
                inputData={inputData}
                inputSize={inputSize}
                isLocked={isLocked}
                nodeId={nodeId}
                schemaId={schemaId}
                setInputValue={setInputValue}
            />
        );
    }
);

export const NodeInputs = memo(
    ({ schema, id, inputData, setInputValue, inputSize, isLocked = false }: NodeInputsProps) => {
        const { schemaInputs } = useContext(BackendContext);

        const { schemaId } = schema;

        const inputs = schemaInputs.get(schemaId);

        return (
            <>
                {inputs.map((item) => (
                    <ItemRenderer
                        inputData={inputData}
                        inputSize={inputSize}
                        isLocked={isLocked}
                        item={item}
                        key={getUniqueKey(item)}
                        nodeId={id}
                        schemaId={schemaId}
                        setInputValue={setInputValue}
                    />
                ))}
            </>
        );
    }
);
