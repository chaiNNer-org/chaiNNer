import { NeverType, Type } from '@chainner/navi';
import { HStack } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Input, InputKind, InputValue, Size } from '../../../common/common-types';
import { getInputValue } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { NodeState } from '../../helpers/nodeState';
import { ColorInput } from './ColorInput';
import { DirectoryInput } from './DirectoryInput';
import { DropDownInput } from './DropDownInput';
import { FileInput } from './FileInput';
import { GenericInput } from './GenericInput';
import { HandleWrapper, InputContainer, WithLabel } from './InputContainer';
import { NumberInput } from './NumberInput';
import { InputProps } from './props';
import { SliderInput } from './SliderInput';
import { TextInput } from './TextInput';

const InputComponents: {
    readonly [K in InputKind]: React.MemoExoticComponent<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (props: InputProps<K, any>) => JSX.Element
    >;
} = {
    file: FileInput,
    directory: DirectoryInput,
    text: TextInput,
    dropdown: DropDownInput,
    number: NumberInput,
    slider: SliderInput,
    color: ColorInput,
    generic: GenericInput,
};

export interface SingleInputProps {
    input: Input;
    nodeState: NodeState;
    afterInput?: JSX.Element;
}
/**
 * Represents a single input from a schema's input list.
 */
export const SchemaInput = memo(({ input, nodeState, afterInput }: SingleInputProps) => {
    const { id: inputId, kind, hasHandle } = input;
    const {
        schemaId,
        id: nodeId,
        inputData,
        setInputValue,
        inputSize,
        setInputSize,
        isLocked,
    } = nodeState;

    const functionDefinition = useContextSelector(BackendContext, (c) =>
        c.functionDefinitions.get(schemaId)
    );
    const definitionType = functionDefinition?.inputDefaults.get(inputId) ?? NeverType.instance;
    const connectableType =
        functionDefinition?.inputConvertibleDefaults.get(inputId) ?? NeverType.instance;

    const value = getInputValue(inputId, inputData);
    const setValue = useCallback(
        (newValue: NonNullable<InputValue>) => {
            setInputValue(inputId, newValue);
        },
        [inputId, setInputValue]
    );
    const resetValue = useCallback(() => {
        setInputValue(inputId, undefined);
    }, [inputId, setInputValue]);

    const size = inputSize?.[inputId];
    const setSize = useCallback(
        (newSize: Readonly<Size>) => {
            setInputSize(inputId, newSize);
        },
        [inputId, setInputSize]
    );

    const useInputConnected = useCallback((): boolean => {
        // TODO: move the function call into the selector
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            nodeId,
            inputId
        );
    }, [nodeId, inputId]);
    const useInputType = useCallback((): Type => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useContextSelector(GlobalVolatileContext, (c) => {
            const type = c.typeState.functions.get(nodeId)?.inputs.get(inputId);
            return type ?? NeverType.instance;
        });
    }, [nodeId, inputId]);

    const InputType = InputComponents[kind];
    let inputElement = (
        <InputType
            definitionType={definitionType}
            input={input as never}
            inputKey={`${schemaId}-${inputId}`}
            isLocked={isLocked}
            nodeId={nodeId}
            nodeSchemaId={schemaId}
            resetValue={resetValue}
            setSize={setSize}
            setValue={setValue}
            size={size}
            useInputConnected={useInputConnected}
            useInputType={useInputType}
            value={value}
        />
    );

    if (afterInput) {
        inputElement = (
            <HStack w="full">
                {inputElement}
                {afterInput}
            </HStack>
        );
    }

    if (kind !== 'generic' && kind !== 'slider' && kind !== 'dropdown' && kind !== 'color') {
        inputElement = <WithLabel input={input}>{inputElement}</WithLabel>;
    }

    return (
        <InputContainer>
            {hasHandle ? (
                <HandleWrapper
                    connectableType={connectableType}
                    id={nodeId}
                    inputId={inputId}
                >
                    {inputElement}
                </HandleWrapper>
            ) : (
                inputElement
            )}
        </InputContainer>
    );
});
