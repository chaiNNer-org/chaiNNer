import { NeverType, Type } from '@chainner/navi';
import { HStack } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import {
    Input,
    InputData,
    InputKind,
    InputSize,
    InputValue,
    SchemaId,
} from '../../../common/common-types';
import { getInputValue } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { DirectoryInput } from './DirectoryInput';
import { DropDownInput } from './DropDownInput';
import { FileInput } from './FileInput';
import { GenericInput } from './GenericInput';
import { HandleWrapper, InputContainer, WithLabel } from './InputContainer';
import { NumberInput } from './NumberInput';
import { InputProps } from './props';
import { SliderInput } from './SliderInput';
import { TextAreaInput } from './TextAreaInput';
import { TextInput } from './TextInput';

const InputComponents: {
    readonly [K in InputKind]: React.MemoExoticComponent<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (props: InputProps<K, any>) => JSX.Element
    >;
} = {
    file: FileInput,
    directory: DirectoryInput,
    'text-line': TextInput,
    text: TextAreaInput,
    dropdown: DropDownInput,
    number: NumberInput,
    slider: SliderInput,
    generic: GenericInput,
};

export interface SingleInputProps {
    input: Input;
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    inputSize: InputSize | undefined;
    onSetValue?: (value: InputValue) => void;
    afterInput?: JSX.Element;
}
/**
 * Represents a single input from a schema's input list.
 */
export const SchemaInput = memo(
    ({
        input,
        schemaId,
        nodeId,
        isLocked,
        inputData,
        inputSize,
        onSetValue,
        afterInput,
    }: SingleInputProps) => {
        const { id: inputId, kind, hasHandle } = input;

        const { setNodeInputValue, useInputSize: useInputSizeContext } = useContext(GlobalContext);

        const functionDefinition = useContextSelector(BackendContext, (c) =>
            c.functionDefinitions.get(schemaId)
        );
        const definitionType = functionDefinition?.inputDefaults.get(inputId) ?? NeverType.instance;
        const connectableType =
            functionDefinition?.inputConvertibleDefaults.get(inputId) ?? NeverType.instance;

        const value = getInputValue(inputId, inputData);
        const setValue = useCallback(
            (data: NonNullable<InputValue>) => {
                setNodeInputValue(nodeId, inputId, data);
                onSetValue?.(data);
            },
            [nodeId, inputId, setNodeInputValue, onSetValue]
        );
        const resetValue = useCallback(() => {
            setNodeInputValue(nodeId, inputId, undefined);
            onSetValue?.(undefined);
        }, [nodeId, inputId, setNodeInputValue, onSetValue]);

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
        const useInputSize = useCallback(
            // eslint-disable-next-line react-hooks/rules-of-hooks
            () => useInputSizeContext(nodeId, inputId, inputSize),
            [useInputSizeContext, nodeId, inputId, inputSize]
        );

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
                setValue={setValue}
                useInputConnected={useInputConnected}
                useInputSize={useInputSize}
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

        if (kind !== 'generic' && kind !== 'slider' && kind !== 'dropdown') {
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
    }
);
