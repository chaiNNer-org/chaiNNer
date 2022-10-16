/* eslint-disable react/jsx-props-no-spreading */

import { Type } from '@chainner/navi';
import { memo, useCallback } from 'react';
import { useContext } from 'use-context-selector';
import {
    Input,
    InputData,
    InputId,
    InputKind,
    InputSchemaValue,
    InputSize,
    NodeSchema,
} from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { DirectoryInput } from '../inputs/DirectoryInput';
import { DropDownInput } from '../inputs/DropDownInput';
import { FileInput } from '../inputs/FileInput';
import { GenericInput } from '../inputs/GenericInput';
import { InputContainer } from '../inputs/InputContainer';
import { NumberInput } from '../inputs/NumberInput';
import { InputProps } from '../inputs/props';
import { SliderInput } from '../inputs/SliderInput';
import { TextAreaInput } from '../inputs/TextAreaInput';
import { TextInput } from '../inputs/TextInput';

interface FullInputProps extends Omit<Omit<Input, 'type'>, 'id'>, InputProps {
    accentColor: string;
    definitionType: Type;
}

const InputComponents: Readonly<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Record<InputKind, React.MemoExoticComponent<(props: any) => JSX.Element>>
> = {
    file: FileInput,
    directory: DirectoryInput,
    'text-line': TextInput,
    text: TextAreaInput,
    dropdown: DropDownInput,
    number: NumberInput,
    slider: SliderInput,
    generic: GenericInput,
};

const pickInput = (kind: InputKind, props: FullInputProps) => {
    const InputType = InputComponents[kind];
    return (
        <InputContainer
            definitionType={props.definitionType}
            generic={kind === 'generic'}
            hasHandle={props.hasHandle}
            id={props.id}
            inputId={props.inputId}
            key={`${props.id}-${props.inputId}`}
            label={props.label}
            optional={props.optional}
        >
            <InputType {...props} />
        </InputContainer>
    );
};

interface NodeInputsProps {
    schema: NodeSchema;
    id: string;
    inputData: InputData;
    inputSize?: InputSize;
    isLocked?: boolean;
    accentColor: string;
}

export const NodeInputs = memo(
    ({ schema, id, inputData, inputSize, isLocked, accentColor }: NodeInputsProps) => {
        const { inputs, schemaId } = schema;

        const { useInputData: useInputDataContext, useInputSize: useInputSizeContext } =
            useContext(GlobalContext);
        const { functionDefinitions } = useContext(BackendContext);

        const useInputData = useCallback(
            <T extends InputSchemaValue>(inputId: InputId) =>
                // eslint-disable-next-line react-hooks/rules-of-hooks
                useInputDataContext<T>(id, inputId, inputData),
            [useInputDataContext, id, inputData]
        );

        const useInputSize = useCallback(
            (inputId: InputId) =>
                // eslint-disable-next-line react-hooks/rules-of-hooks
                useInputSizeContext(id, inputId, inputSize),
            [useInputSizeContext, id, inputSize]
        );

        const functions = functionDefinitions.get(schemaId)!.inputDefaults;

        return (
            <>
                {inputs.map((input) => {
                    const props: FullInputProps = {
                        ...input,
                        id,
                        inputId: input.id,
                        inputData,
                        useInputData,
                        useInputSize,
                        kind: input.kind,
                        isLocked: isLocked ?? false,
                        schemaId,
                        definitionType: functions.get(input.id)!,
                        accentColor,
                        optional: input.optional,
                        hasHandle: input.hasHandle,
                    };
                    return pickInput(input.kind, props);
                })}
            </>
        );
    }
);
