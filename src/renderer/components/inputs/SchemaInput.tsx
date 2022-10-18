import { NeverType, Type } from '@chainner/navi';
import { memo, useCallback } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { Input, InputData, InputKind, InputSize, SchemaId } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { DirectoryInput } from './DirectoryInput';
import { DropDownInput } from './DropDownInput';
import { FileInput } from './FileInput';
import { GenericInput } from './GenericInput';
import { HandleWrapper, InputContainer } from './InputContainer';
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
}
/**
 * Represents a single input from a schema's input list.
 */
export const SchemaInput = memo(
    ({ input, schemaId, nodeId, isLocked, inputData, inputSize }: SingleInputProps) => {
        const { id: inputId, kind, hasHandle, optional, label } = input;

        const { useInputData, useInputSize: useInputSizeContext } = useContext(GlobalContext);
        const definitionType = useContextSelector(BackendContext, (c) =>
            c.functionDefinitions.get(schemaId)?.inputDefaults.get(inputId)
        );

        const [value, setValue, resetValue] = useInputData(nodeId, inputId, inputData);

        const useInputLocked = useCallback((): boolean => {
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
        const inputElement = (
            <InputType
                definitionType={definitionType!}
                input={input as never}
                inputKey={`${schemaId}-${inputId}`}
                isLocked={isLocked}
                resetValue={resetValue}
                setValue={setValue}
                useInputLocked={useInputLocked}
                useInputSize={useInputSize}
                useInputType={useInputType}
                value={value}
            />
        );

        return (
            <InputContainer
                generic={kind === 'generic'}
                label={label}
                optional={optional}
            >
                {hasHandle ? (
                    <HandleWrapper
                        definitionType={definitionType!}
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
