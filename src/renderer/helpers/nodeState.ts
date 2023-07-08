import { useCallback, useMemo } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import {
    Condition,
    InputData,
    InputId,
    InputSize,
    InputValue,
    NodeData,
    NodeSchema,
    OutputId,
    SchemaId,
    Size,
} from '../../common/common-types';
import { IdSet } from '../../common/IdSet';
import { testInputCondition } from '../../common/nodes/condition';
import { FunctionInstance } from '../../common/types/function';
import { EMPTY_ARRAY, EMPTY_SET } from '../../common/util';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { useMemoObject } from '../hooks/useMemo';

export interface TypeInfo {
    readonly instance: FunctionInstance | undefined;
    readonly connectedInputs: ReadonlySet<InputId>;
}

const useTypeInfo = (id: string): TypeInfo => {
    const instance = useContextSelector(GlobalVolatileContext, (c) =>
        c.typeState.functions.get(id)
    );

    const connectedInputsString = useContextSelector(GlobalVolatileContext, (c) => {
        const connected = c.typeState.edges.byTarget.get(id);
        return IdSet.from(connected?.map((connection) => connection.inputId) ?? EMPTY_ARRAY);
    });
    const connectedInputs = useMemo(() => {
        if (IdSet.isEmpty(connectedInputsString)) return EMPTY_SET;
        return IdSet.toSet(connectedInputsString);
    }, [connectedInputsString]);

    return useMemoObject<TypeInfo>({
        instance,
        connectedInputs,
    });
};

export const testInputConditionTypeInfo = (
    condition: Condition,
    inputData: InputData,
    typeInfo: TypeInfo
): boolean => {
    return testInputCondition(
        condition,
        inputData,
        (id) => typeInfo.instance?.inputs.get(id),
        (id) => typeInfo.connectedInputs.has(id)
    );
};

export interface NodeState {
    readonly id: string;
    readonly schemaId: SchemaId;
    readonly schema: NodeSchema;
    readonly inputData: InputData;
    readonly setInputValue: (inputId: InputId, value: InputValue) => void;
    readonly inputSize: InputSize | undefined;
    readonly setInputSize: (inputId: InputId, size: Readonly<Size>) => void;
    readonly isLocked: boolean;
    readonly connectedInputs: ReadonlySet<InputId>;
    readonly connectedOutputs: ReadonlySet<OutputId>;
    readonly type: TypeInfo;
    readonly testCondition: (condition: Condition) => boolean;
    readonly useFakeHandles: boolean;
}

export const useNodeStateFromData = (data: NodeData): NodeState => {
    const { setNodeInputValue, setNodeInputSize } = useContext(GlobalContext);

    const { id, inputData, inputSize, isLocked, schemaId } = data;

    const setInputValue = useMemo(() => setNodeInputValue.bind(null, id), [id, setNodeInputValue]);
    const setInputSize = useMemo(() => setNodeInputSize.bind(null, id), [id, setNodeInputSize]);

    const { schemata } = useContext(BackendContext);
    const schema = schemata.get(schemaId);

    const connectedString = useContextSelector(GlobalVolatileContext, (c) =>
        JSON.stringify(c.getConnected(id))
    );
    const [connectedInputs, connectedOutputs] = useMemo(() => {
        const [inputsSet, outputsSet] = JSON.parse(connectedString) as [
            IdSet<InputId>,
            IdSet<OutputId>
        ];

        return [IdSet.toSet(inputsSet), IdSet.toSet(outputsSet)];
    }, [connectedString]);

    const type = useTypeInfo(id);

    const testCondition = useCallback(
        (condition: Condition) => testInputConditionTypeInfo(condition, inputData, type),
        [inputData, type]
    );

    return useMemoObject<NodeState>({
        id,
        schemaId,
        schema,
        inputData,
        setInputValue,
        inputSize,
        setInputSize,
        isLocked: isLocked ?? false,
        connectedInputs,
        connectedOutputs,
        type,
        testCondition,
        useFakeHandles: false,
    });
};
