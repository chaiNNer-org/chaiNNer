import { NeverType } from '@chainner/navi';
import { HStack } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Input, InputKind, InputValue, Size } from '../../../common/common-types';
import { getInputValue } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeState } from '../../helpers/nodeState';
import { ColorInput } from './ColorInput';
import { DirectoryInput } from './DirectoryInput';
import { DropDownInput } from './DropDownInput';
import { FileInput } from './FileInput';
import { GenericInput } from './GenericInput';
import { HandleWrapper, InputContainer } from './InputContainer';
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
        inputHeight,
        setInputHeight,
        nodeWidth,
        setWidth,
        isLocked,
        connectedInputs,
        type,
        schema,
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

    const size =
        inputHeight?.[inputId] && nodeWidth
            ? { height: inputHeight[inputId], width: nodeWidth }
            : undefined;
    const setSize = useCallback(
        (newSize: Readonly<Size>) => {
            setInputHeight(inputId, newSize.height);
            setWidth(newSize.width);
        },
        [inputId, setInputHeight, setWidth]
    );

    const inputType = type.instance?.inputs.get(inputId) ?? NeverType.instance;

    const InputType = InputComponents[kind];
    let inputElement = (
        <InputType
            definitionType={definitionType}
            input={input as never}
            inputKey={`${schemaId}-${inputId}`}
            inputType={inputType}
            isConnected={connectedInputs.has(inputId)}
            isLocked={isLocked}
            nodeId={nodeId}
            nodeSchemaId={schemaId}
            resetValue={resetValue}
            setSize={setSize}
            setValue={setValue}
            size={size}
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

    return (
        <InputContainer>
            {hasHandle ? (
                <HandleWrapper
                    connectableType={connectableType}
                    id={nodeId}
                    inputId={inputId}
                    nodeType={schema.nodeType}
                >
                    {inputElement}
                </HandleWrapper>
            ) : (
                inputElement
            )}
        </InputContainer>
    );
});
