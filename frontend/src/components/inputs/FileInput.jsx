/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Input, InputGroup, InputLeftElement, VisuallyHidden,
} from '@chakra-ui/react';
import React, { memo, useContext, useRef } from 'react';
import { BsFileEarmarkPlus } from 'react-icons/bs';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const FileInput = memo(({
  extensions, data, index, label,
}) => {
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData, setNodeData] = useNodeData(id);

  const inputFile = useRef(null);

  const onButtonClick = () => {
    inputFile.current.click();
    inputFile.current.blur();
  };

  const handleChange = (event) => {
    const file = event.target.files[0];
    console.log('🚀 ~ file: FileInput.jsx ~ line 27 ~ handleChange ~ file', file);
    if (file) {
      const inputData = nodeData?.inputData ?? {};
      console.log('🚀 ~ file: FileInput.jsx ~ line 30 ~ handleChange ~ inputData', inputData);
      const sharedData = nodeData?.sharedData ?? {};
      console.log('🚀 ~ file: FileInput.jsx ~ line 32 ~ handleChange ~ sharedData', sharedData);
      inputData[index] = file.path;
      sharedData.file = {};
      sharedData.file.path = file.path;
      sharedData.file.name = file.name;
      setNodeData({ inputData, sharedData });
    }

    inputFile.current.blur();
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <VisuallyHidden>
        {/* TODO: Replace this with the native electron dialog that does the same thing
                  I have no idea if it's any better, but it might be less jank.
        */}
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
      <InputGroup>
        <InputLeftElement
          pointerEvents="none"
        >
          <BsFileEarmarkPlus />
        </InputLeftElement>
        <Input
          placeholder="Select a file..."
          value={nodeData?.sharedData?.file?.name ?? ''}
          isReadOnly
          onClick={onButtonClick}
          isTruncated
        // bg={useColorModeValue('gray.500', 'gray.200')}
        // textColor={useColorModeValue('gray.200', 'gray.700')}
        // borderColor={useColorModeValue('gray.200', 'gray.700')}
        // _placeholder={{ color: useColorModeValue('gray.200', 'gray.700') }}
          draggable={false}
          cursor="pointer"
        />
      </InputGroup>
    </InputContainer>
  );
});

export default FileInput;
