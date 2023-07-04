import { useMemo } from 'react';
import { useContext } from 'use-context-selector';
import {
    InputData,
    InputId,
    InputSize,
    InputValue,
    NodeData,
    NodeSchema,
    SchemaId,
    Size,
} from '../../common/common-types';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { useMemoObject } from '../hooks/useMemo';

export interface NodeState {
    readonly id: string;
    readonly schemaId: SchemaId;
    readonly schema: NodeSchema;
    readonly inputData: InputData;
    readonly setInputValue: (inputId: InputId, value: InputValue) => void;
    readonly inputSize: InputSize | undefined;
    readonly setInputSize: (inputId: InputId, size: Readonly<Size>) => void;
    readonly isLocked: boolean;
}

export const useNodeStateFromData = (data: NodeData): NodeState => {
    const { setNodeInputValue, setNodeInputSize } = useContext(GlobalContext);

    const { id, inputData, inputSize, isLocked, schemaId } = data;

    const setInputValue = useMemo(() => setNodeInputValue.bind(null, id), [id, setNodeInputValue]);
    const setInputSize = useMemo(() => setNodeInputSize.bind(null, id), [id, setNodeInputSize]);

    const { schemata } = useContext(BackendContext);
    const schema = schemata.get(schemaId);

    return useMemoObject({
        id,
        schemaId,
        schema,
        inputData,
        setInputValue,
        inputSize,
        setInputSize,
        isLocked: isLocked ?? false,
    });
};
