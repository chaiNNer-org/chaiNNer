/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input, useColorModeValue, VisuallyHidden } from '@chakra-ui/react';
import React, {
  useContext, useRef,
} from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

function ImageFileInput({ extensions, data, index }) {
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
    if (file) {
      const inputData = nodeData?.inputData ?? {};
      const sharedData = nodeData?.sharedData ?? {};
      inputData[index] = file.path;
      sharedData.file = file;
      setNodeData({ inputData, sharedData });
    }

    inputFile.current.blur();
  };

  return (
    <InputContainer id={id} index={index}>
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
      <Input
        placeholder="Image..."
        value={nodeData?.sharedData?.file?.name ?? ''}
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
