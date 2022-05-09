/* eslint-disable react/jsx-props-no-spreading */

import { memo } from 'react';
import { Input } from '../../common-types';
import DirectoryInput from '../inputs/DirectoryInput';
import DropDownInput from '../inputs/DropDownInput';
import FileInput from '../inputs/FileInput';
import GenericInput from '../inputs/GenericInput';
import InputContainer from '../inputs/InputContainer';
import NumberInput from '../inputs/NumberInput';
import SliderInput from '../inputs/SliderInput';
import TextAreaInput from '../inputs/TextAreaInput';
import TextInput from '../inputs/TextInput';

interface InputProps extends Input {
    id: string;
    index: number;
    type: string;
    accentColor: string;
    isLocked?: boolean;
    category: string;
    name: string;
    hasHandle?: boolean;
    schemaId: string;
}

// TODO: perhaps make this an object instead of a switch statement
const pickInput = (type: string, props: InputProps) => {
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
        case 'number::integer':
            InputType = NumberInput;
            break;
        case 'number::integer::odd':
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
                    <GenericInput label={props.label} />
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
    accentColor: string;
    isLocked?: boolean;
    category: string;
    name: string;
    schemaId: string;
}

const NodeInputs = ({
    inputs,
    id,
    accentColor,
    isLocked,
    category,
    name,
    schemaId,
}: NodeInputsProps) => (
    <>
        {inputs.map((input, i) => {
            const props: InputProps = {
                ...input,
                id,
                index: i,
                type: input.type,
                accentColor,
                isLocked,
                category,
                name,
                schemaId,
            };
            return pickInput(input.type, props);
        })}
    </>
);
export default memo(NodeInputs);
