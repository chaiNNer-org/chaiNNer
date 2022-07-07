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
import { Type } from '../../../common/types/types';
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

interface FullInputProps extends Omit<Omit<Input, 'type'>, 'id'>, InputProps {
    accentColor: string;
    definitionType: Type;
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
                    generic
                    definitionType={props.definitionType}
                    hasHandle={props.hasHandle}
                    id={props.id}
                    inputId={props.inputId}
                    key={`${props.id}-${props.inputId}`}
                    optional={props.optional}
                >
                    <GenericInput {...props} />
                </InputContainer>
            );
        default:
            return assertNever(kind);
    }
    return (
        <InputContainer
            definitionType={props.definitionType}
            generic={false}
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
    inputs: readonly Input[];
    id: string;
    inputData: InputData;
    isLocked?: boolean;
    schemaId: SchemaId;
    accentColor: string;
}

const NodeInputs = memo(
    ({ inputs, id, inputData, isLocked, schemaId, accentColor }: NodeInputsProps) => {
        const { useInputData: useInputDataContext, functionDefinitions } =
            useContext(GlobalContext);

        const useInputData = useCallback(
            <T extends InputSchemaValue>(inputId: number) =>
                // eslint-disable-next-line react-hooks/rules-of-hooks
                useInputDataContext<T>(id, inputId, inputData),
            [useInputDataContext, id, inputData]
        );

        const functions = functionDefinitions.get(schemaId)!.inputs;

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
                        isLocked: isLocked ?? false,
                        schemaId,
                        definitionType: functions.get(input.id)!,
                        accentColor,
                        optional: input.optional,
                    };
                    return pickInput(input.kind, props);
                })}
            </>
        );
    }
);

export default NodeInputs;
