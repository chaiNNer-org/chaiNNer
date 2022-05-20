/* eslint-disable react/jsx-props-no-spreading */

import { memo, useCallback } from 'react';
import { useContext } from 'use-context-selector';
import { Input, InputData, InputSchemaValue } from '../../../common/common-types';
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

interface FullInputProps extends Input, InputProps {
    type: string;
    accentColor: string;
    hasHandle?: boolean;
}

// TODO: perhaps make this an object instead of a switch statement
const pickInput = (type: string, props: FullInputProps) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let InputType: React.MemoExoticComponent<(props: any) => JSX.Element> = GenericInput;
    switch (type) {
        case 'file::image':
            InputType = FileInput;
            break;
        case 'file::pth':
            InputType = FileInput;
            break;
        case 'file::video':
            InputType = FileInput;
            break;
        case 'file::directory':
            InputType = DirectoryInput;
            break;
        case 'file::bin':
            InputType = FileInput;
            break;
        case 'file::param':
            InputType = FileInput;
            break;
        case 'text::any':
            InputType = TextInput;
            break;
        case 'textarea::note':
            InputType = TextAreaInput;
            break;
        case 'dropdown::str':
            InputType = DropDownInput;
            break;
        case 'dropdown::image-extensions':
            InputType = DropDownInput;
            break;
        case 'dropdown::math-operations':
            InputType = DropDownInput;
            break;
        case 'dropdown::generic':
            InputType = DropDownInput;
            break;
        case 'number::any':
            InputType = NumberInput;
            break;
        case 'number::slider':
            InputType = SliderInput;
            break;
        default:
            return (
                <InputContainer
                    hasHandle={props.hasHandle ?? true}
                    id={props.id}
                    index={props.index}
                    key={`${props.id}-${props.index}`}
                >
                    <GenericInput {...props} />
                </InputContainer>
            );
    }
    return (
        <InputContainer
            hasHandle={props.hasHandle}
            id={props.id}
            index={props.index}
            key={`${props.id}-${props.index}`}
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
    schemaId: string;
}

const NodeInputs = ({
    inputs,
    id,
    inputData,
    accentColor,
    isLocked,
    schemaId,
}: NodeInputsProps) => {
    const { useInputData: useInputDataContext } = useContext(GlobalContext);

    const useInputData = useCallback(
        <T extends InputSchemaValue>(index: number) => useInputDataContext<T>(id, index, inputData),
        [useInputDataContext, id, inputData]
    );

    return (
        <>
            {inputs.map((input, i) => {
                const props: FullInputProps = {
                    ...input,
                    id,
                    index: i,
                    inputData,
                    useInputData,
                    type: input.type,
                    accentColor,
                    isLocked: isLocked ?? false,
                    schemaId,
                };
                return pickInput(input.type, props);
            })}
        </>
    );
};
export default memo(NodeInputs);
