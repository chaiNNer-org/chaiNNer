/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input, useColorModeValue, VisuallyHidden } from '@chakra-ui/react';
import React, { useRef, useState } from 'react';
import InputContainer from './InputContainer.jsx';

function PthFileInput({ extensions }) {
  const [pth, setPth] = useState({ name: '', path: '' });
  const inputFile = useRef(null);

  const onButtonClick = () => {
    inputFile.current.click();
    inputFile.current.blur();
  };

  const handleChange = (event) => {
    const file = event.target.files[0];
    if (file && pth.path !== file.path) {
      setPth(file);
    }
    inputFile.current.blur();
  };

  return (
    <InputContainer>
      <VisuallyHidden>
        <input
          type="file"
          id="file"
          accept={`.${extensions.join(',.')}`}
          ref={inputFile}
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </VisuallyHidden>
      <Input
        placeholder="Model..."
        value={pth.name}
        isReadOnly
        onClick={onButtonClick}
        isTruncated
        bg={useColorModeValue('gray.200', 'gray.600')}
      />
    </InputContainer>
  );
}

export default PthFileInput;
