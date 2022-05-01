/* eslint-disable react/jsx-props-no-spreading */

import { memo } from 'react';
import DirectoryInput from '../inputs/DirectoryInput';
import DropDownInput from '../inputs/DropDownInput';
import FileInput from '../inputs/FileInput';
import GenericInput from '../inputs/GenericInput';
import InputContainer from '../inputs/InputContainer';
import NumberInput from '../inputs/NumberInput';
import SliderInput from '../inputs/SliderInput';
import TextAreaInput from '../inputs/TextAreaInput';
import TextInput from '../inputs/TextInput';

// TODO: perhaps make this an object instead of a switch statement
const pickInput = (type, props) => {
  let InputType = GenericInput;
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
          hasHandle={props.hasHandle === undefined ? true : props.hasHandle}
          id={props.id}
          index={props.index}
          key={`${props.id}-${props.index}`}
          label={null}
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

const NodeInputs = ({ inputs, id, accentColor, isLocked, category, nodeType }) =>
  inputs.map((input, i) => {
    const props = {
      ...input,
      id,
      index: i,
      type: input.type,
      accentColor,
      isLocked,
      category,
      nodeType,
    };
    return pickInput(input.type, props);
  });
export default memo(NodeInputs);
