/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Select } from '@chakra-ui/react';
import React, { memo, useContext, useEffect } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const DropDownInput = memo(({
  label, options, id, index, isLocked,
}) => {
  const { useInputData } = useContext(GlobalContext);
  const [selection, setSelection] = useInputData(id, index);

  const handleChange = (event) => {
    const { value } = event.target;
    setSelection(value);
  };

  useEffect(() => {
    setSelection(options[0].value);
  }, []);

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
