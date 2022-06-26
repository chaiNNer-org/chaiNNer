/* eslint-disable react/jsx-props-no-spreading */

import { memo, useCallback } from 'react';
import { useContext } from 'use-context-selector';
import {
    Input,
    InputData,
    InputKind,
    InputSchemaValue,
    SchemaId,
} from '../../../common/common-types';
import { assertNever } from '../../../common/util';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import DirectoryInput from '../inputs/DirectoryInput';
import DropDownInput from '../inputs/DropDownInput';
import FileInput from '../inputs/FileInput';
import GenericInput from '../inputs/GenericInput';
import InputContainer from '../inputs/InputContainer';
import NumberInput from '../inputs/NumberInput';
import { InputProps } from '../inputs/props';
import SliderInput from '../inputs/SliderInput';
import TextAreaInput from '../inputs/TextAreaInput';
import TextInput from '../inputs/TextInput';

interface FullInputProps extends Omit<Input, 'id'>, InputProps {
    accentColor: string;
}

// TODO: perhaps make this an object instead of a switch statement
const pickInput = (kind: InputKind, props: FullInputProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let InputType: React.MemoExoticComponent<(props: any) => JSX.Element> = GenericInput;
    switch (kind) {
        case 'file':
            InputType = FileInput;
            break;
        case 'directory':
            InputType = DirectoryInput;
            break;
        case 'text-line':
            InputType = TextInput;
            break;
        case 'text':
            InputType = TextAreaInput;
            break;
        case 'dropdown':
            InputType = DropDownInput;
            break;
        case 'number':
            InputType = NumberInput;
            break;
        case 'slider':
            InputType = SliderInput;
            break;
        case 'generic':
            return (
                <InputContainer
                    hasHandle={props.hasHandle}
                    id={props.id}
                    inputId={props.inputId}
                    key={`${props.id}-${props.inputId}`}
                >
                    <GenericInput {...props} />
                </InputContainer>
            );
        default:
            return assertNever(kind);
    }
    return (
        <InputContainer
            hasHandle={props.hasHandle}
            id={props.id}
            inputId={props.inputId}
            key={`${props.id}-${props.inputId}`}
            label={props.label}
        >
            <InputType {...props} />
        </InputContainer>
    );
};

interface NodeInputsProps {
    inputs: readonly Input[];
    id: string;
    inputData: InputData;
    accentColor: string;
    isLocked?: boolean;
    schemaId: SchemaId;
}

const NodeInputs = memo(
    ({ inputs, id, inputData, accentColor, isLocked, schemaId }: NodeInputsProps) => {
        const { useInputData: useInputDataContext } = useContext(GlobalContext);

        const useInputData = useCallback(
            <T extends InputSchemaValue>(inputId: number) =>
                useInputDataContext<T>(id, inputId, inputData),
            [useInputDataContext, id, inputData]
        );

        return (
            <>
                {inputs.map((input) => {
                    const props: FullInputProps = {
                        ...input,
                        id,
                        inputId: input.id,
                        inputData,
                        useInputData,
                        kind: input.kind,
                        accentColor,
                        isLocked: isLocked ?? false,
                        schemaId,
                    };
                    return pickInput(input.kind, props);
                })}
            </>
        );
    }
);

export default NodeInputs;
