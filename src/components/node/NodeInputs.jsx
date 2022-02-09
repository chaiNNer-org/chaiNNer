/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import React, {
  memo,
} from 'react';
import DirectoryInput from '../inputs/DirectoryInput.jsx';
import DropDownInput from '../inputs/DropDownInput.jsx';
import FileInput from '../inputs/FileInput.jsx';
import GenericInput from '../inputs/GenericInput.jsx';
import InputContainer from '../inputs/InputContainer.jsx';
import NumberInput from '../inputs/NumberInput.jsx';
import SliderInput from '../inputs/SliderInput.jsx';
import TextInput from '../inputs/TextInput.jsx';

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
    case 'file::directory':
      InputType = DirectoryInput;
      break;
    case 'text::any':
      InputType = TextInput;
      break;
    case 'dropdown::image-extensions':
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
          key={`${props.id}-${props.index}`}
          id={props.id}
          index={props.index}
          label={null}
          hasHandle
        >
          <GenericInput label={props.label} />
        </InputContainer>
      );
  }
  return (
    <InputContainer
      key={`${props.id}-${props.index}`}
      id={props.id}
      index={props.index}
      label={props.label}
      hasHandle={props.hasHandle}
    >
      <InputType {...props} />
    </InputContainer>
  );
};

const NodeInputs = ({ data, accentColor }) => {
  const { inputs, id } = data;

  return inputs.map((input, i) => {
    const props = {
      ...input, id, index: i, type: input.type, accentColor,
    };
    return pickInput(input.type, props);
  });
};
export default memo(NodeInputs);
