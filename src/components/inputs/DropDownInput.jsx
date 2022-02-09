/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Select } from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const DropDownInput = memo(({
  label, options, id, index,
}) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [selection, setSelection] = useInputData(id, index);
  const [isLocked] = useNodeLock(id);

  const handleChange = (event) => {
    const { value } = event.target;
    setSelection(value);
  };

  return (
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
  );
});

export default DropDownInput;
