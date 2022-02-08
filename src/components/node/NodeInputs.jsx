/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import React, {
  memo,
} from 'react';
import DirectoryInput from '../inputs/DirectoryInput.jsx';
import DropDownInput from '../inputs/DropDownInput.jsx';
import FileInput from '../inputs/FileInput.jsx';
import GenericInput from '../inputs/GenericInput.jsx';
import NumberInput from '../inputs/NumberInput.jsx';
import SliderInput from '../inputs/SliderInput.jsx';
import TextInput from '../inputs/TextInput.jsx';

const NodeInputs = ({ data }) => {
  const { inputs } = data;

  return inputs.map((input, i) => {
    switch (input.type) {
      case 'file::image':
        return (
          <FileInput
            key={i}
            index={i}
            extensions={input.filetypes}
            data={data}
            label={input.label}
          />
        );
      case 'file::pth':
        return (
          <FileInput
            key={i}
            index={i}
            extensions={input.filetypes}
            data={data}
            label={input.label}
          />
        );
      case 'file::directory':
        return (
          <DirectoryInput
            key={i}
            index={i}
            data={data}
            label={input.label}
          />
        );
      case 'text::any':
        return (
          <TextInput key={i} index={i} data={data} label={input.label} />
        );
      case 'dropdown::image-extensions':
        return (
          <DropDownInput
            key={i}
            index={i}
            data={data}
            label={input.label}
            options={input.options}
          />
        );
      case 'dropdown::generic':
        return (
          <DropDownInput
            key={i}
            index={i}
            data={data}
            label={input.label}
            options={input.options}
          />
        );
      case 'number::any':
        return (
          <NumberInput
            key={i}
            index={i}
            data={data}
            label={input.label}
            min={input.min}
            step={input.step}
          />
        );
      case 'number::integer':
        return (
          <NumberInput
            key={i}
            index={i}
            data={data}
            label={input.label}
            min={input.min}
            precision={0}
          />
        );
      case 'number::integer::odd':
        return (
          <NumberInput
            key={i}
            index={i}
            data={data}
            label={input.label}
            min={1}
            precision={0}
            def={1}
            step={2}
          />
        );
      case 'number::slider':
        return (
          <SliderInput
            key={i}
            index={i}
            data={data}
            label={input.label}
            min={input.min}
            max={input.max}
            def={input.def}
          />
        );
      default:
        return (
          <GenericInput key={i} index={i} label={input.label} data={data} />
        );
    }
  });
};
export default memo(NodeInputs);
