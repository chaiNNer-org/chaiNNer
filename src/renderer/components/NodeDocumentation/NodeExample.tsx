import { Center } from '@chakra-ui/react';
import { memo, useCallback, useMemo, useState } from 'react';
import { Node } from 'reactflow';
import { useContext } from 'use-context-selector';
import {
    InputData,
    InputHeight,
    InputId,
    InputValue,
    NodeData,
    NodeSchema,
    OutputHeight,
    OutputId,
} from '../../../common/common-types';
import { checkNodeValidity } from '../../../common/nodes/checkNodeValidity';
import { TypeState } from '../../../common/nodes/TypeState';
import { PassthroughMap } from '../../../common/PassthroughMap';
import { EMPTY_ARRAY, EMPTY_MAP, EMPTY_OBJECT, EMPTY_SET, noop } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { FakeNodeProvider } from '../../contexts/FakeExampleContext';
import { NodeState, TypeInfo, testForInputConditionTypeInfo } from '../../helpers/nodeState';
import { NodeView } from '../node/Node';

// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, func-names
const useStateForSchema = function <T>(
    schema: NodeSchema,
    defaultValue: T
): [T, (value: (prev: T) => T) => void] {
    const [state, setState] = useState<{ value: T; schema: NodeSchema }>({
        value: defaultValue,
        schema,
    });

    const setValue = useCallback(
        (value: (prev: T) => T): void => {
            setState((prev) => {
                return {
                    value: value(prev.schema === schema ? prev.value : defaultValue),
                    schema,
                };
            });
        },
        [schema, defaultValue]
    );

    const value = state.schema === schema ? state.value : defaultValue;

    return [value, setValue];
};

interface NodeExampleProps {
    selectedSchema: NodeSchema;
}
export const NodeExample = memo(({ selectedSchema }: NodeExampleProps) => {
    const { schemata, functionDefinitions } = useContext(BackendContext);

    const defaultInput = useMemo<InputData>(() => {
        return schemata.getDefaultInput(selectedSchema.schemaId);
    }, [schemata, selectedSchema]);

    const [inputData, setInputData] = useStateForSchema<InputData>(selectedSchema, defaultInput);
    const setInputValue = useCallback(
        (inputId: InputId, value: InputValue): void => {
            setInputData((prev) => ({ ...prev, [inputId]: value }));
        },
        [setInputData]
    );

    const [inputHeight, setInputHeight] = useStateForSchema<InputHeight>(
        selectedSchema,
        EMPTY_OBJECT
    );
    const setSingleInputHeight = useCallback(
        (inputId: InputId, height: number): void => {
            setInputHeight((prev) => ({ ...prev, [inputId]: height }));
        },
        [setInputHeight]
    );

    const [nodeWidth, setNodeWidth] = useStateForSchema<number | undefined>(
        selectedSchema,
        undefined
    );
    const setWidth = useCallback(
        (width: number): void => {
            setNodeWidth((prev) => (prev === undefined ? width : Math.max(prev, width)));
        },
        [setNodeWidth]
    );

    const [outputHeight, setOutputHeight] = useStateForSchema<OutputHeight>(
        selectedSchema,
        EMPTY_OBJECT
    );
    const setSingleOutputHeight = useCallback(
        (outputId: OutputId, height: number): void => {
            setOutputHeight((prev) => ({ ...prev, [outputId]: height }));
        },
        [setOutputHeight]
    );

    const nodeIdPrefix = 'FakeId ';
    const suffixLength = 36 - nodeIdPrefix.length;
    const nodeId =
        nodeIdPrefix + selectedSchema.schemaId.slice(-suffixLength).padStart(suffixLength, ' ');
    if (nodeId.length !== 36) throw new Error('Fake node ID must have the length of a real one.');

    const typeState = useMemo(() => {
        const node: Node<NodeData> = {
            id: nodeId,
            position: { x: 0, y: 0 },
            data: {
                id: nodeId,
                schemaId: selectedSchema.schemaId,
                inputData,
            },
        };
        return TypeState.create(
            new Map([[nodeId, node]]),
            EMPTY_ARRAY,
            EMPTY_MAP,
            functionDefinitions,
            PassthroughMap.EMPTY
        );
    }, [nodeId, selectedSchema, inputData, functionDefinitions]);

    const typeInfo: TypeInfo = {
        instance: typeState.functions.get(nodeId),
        connectedInputs: EMPTY_SET,
    };

    const requiredGenericInputs = new Set(
        selectedSchema.inputs.filter((i) => !i.optional && i.kind === 'generic').map((i) => i.id)
    );
    const validity = checkNodeValidity({
        schema: selectedSchema,
        connectedInputs: requiredGenericInputs,
        inputData,
        functionInstance: typeInfo.instance,
        chainLineage: undefined,
        nodeId,
    });

    const { iteratedInputs, iteratedOutputs } = useMemo(() => {
        return {
            iteratedInputs: new Set(selectedSchema.iteratorInputs.flatMap((i) => i.inputs)),
            iteratedOutputs: new Set(selectedSchema.iteratorOutputs.flatMap((i) => i.outputs)),
        };
    }, [selectedSchema]);

    const nodeState: NodeState = {
        id: nodeId,
        schemaId: selectedSchema.schemaId,
        schema: selectedSchema,
        inputData,
        setInputValue,
        inputHeight,
        nodeWidth,
        outputHeight,
        setOutputHeight: setSingleOutputHeight,
        setWidth,
        setInputHeight: setSingleInputHeight,
        isLocked: false,
        passthrough: undefined,
        connectedInputs: EMPTY_SET,
        connectedOutputs: EMPTY_SET,
        iteratedInputs,
        iteratedOutputs,
        type: typeInfo,
        testCondition: testForInputConditionTypeInfo(inputData, selectedSchema, typeInfo),
        nodeName: undefined,
        setNodeName: noop,
    };

    return (
        <Center key={selectedSchema.schemaId}>
            <FakeNodeProvider isFake>
                <NodeView
                    nodeState={nodeState}
                    validity={validity}
                />
            </FakeNodeProvider>
        </Center>
    );
});
