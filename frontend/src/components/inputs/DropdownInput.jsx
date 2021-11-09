/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Select } from '@chakra-ui/react';
import React, { memo, useContext, useEffect } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const DropDownInput = memo(({
  label, options, data, index,
}) => {
  const { id } = data;
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [selection, setSelection] = useInputData(id, index);
  const [isLocked] = useNodeLock(id);

  // Set the input state to the first option on mount otherwise it thinks nothing is selected
  useEffect(() => {
    setSelection(options[0].value);
  }, []);

  const handleChange = (event) => {
    const { value } = event.target;
    setSelection(value);
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <Select
        value={selection}
        onChange={handleChange}
        draggable={false}
        className="nodrag"
        disabled={isLocked}
      >
        {options.map(({ option, value }) => (
          <option key={option} value={value}>{option}</option>
        ))}
      </Select>
    </InputContainer>
  );
});

export default DropDownInput;
