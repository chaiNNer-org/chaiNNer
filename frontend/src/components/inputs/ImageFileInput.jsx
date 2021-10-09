/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input, useColorModeValue, VisuallyHidden } from '@chakra-ui/react';
import React, { useRef, useState } from 'react';
import InputContainer from './InputContainer.jsx';

function ImageFileInput({ extensions }) {
  const [image, setImage] = useState({ name: '', path: '' });
  const inputFile = useRef(null);

  const onButtonClick = () => {
    inputFile.current.click();
    inputFile.current.blur();
  };

  const handleChange = (event) => {
    const file = event.target.files[0];
    console.log('🚀 ~ file: ImageFileInput.jsx ~ line 19 ~ handleChange ~ file', file);
    if (file && image.path !== file.path) {
      setImage(file);
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
          style={{
            display: 'none',
          }}
          onChange={handleChange}
        />
      </VisuallyHidden>
      <Input
        placeholder="Image..."
        value={image.name}
        isReadOnly
        onClick={onButtonClick}
        isTruncated
        bg={useColorModeValue('gray.500', 'gray.200')}
        textColor={useColorModeValue('gray.200', 'gray.700')}
        borderColor={useColorModeValue('gray.200', 'gray.700')}
        _placeholder={{ color: useColorModeValue('gray.200', 'gray.700') }}
        draggable={false}
        cursor="pointer"
      />
    </InputContainer>
  );
}

export default ImageFileInput;
