/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box, Input, InputGroup, InputLeftElement, VisuallyHidden, VStack,
} from '@chakra-ui/react';
import path from 'path';
import React, {
  memo, useContext, useRef,
} from 'react';
import { BsFileEarmarkPlus } from 'react-icons/bs';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import ImagePreview from './previews/ImagePreview.jsx';

const FileInput = memo(({
  filetypes, id, index, label, type, isLocked,
}) => {
  const { useInputData } = useContext(GlobalContext);
  const [filePath, setFilePath] = useInputData(id, index);

  const inputFile = useRef(null);

  const onButtonClick = () => {
    inputFile.current.click();
    inputFile.current.blur();
  };

  const handleChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFilePath(file.path);
    }
    inputFile.current.blur();
  };

  const preview = () => {
    switch (type) {
      case 'file::image':
        return <ImagePreview path={filePath} />;
      default:
        return <></>;
    }
  };

  return (
    <>
      <VisuallyHidden>
        {/* TODO: Replace this with the native electron dialog that does the same thing
                  I have no idea if it's any better, but it might be less jank.
        */}
        <input
          type="file"
          id="file"
          accept={`.${filetypes.join(',.')}`}
          ref={inputFile}
          style={{
            display: 'none',
          }}
          onChange={handleChange}
        />
      </VisuallyHidden>
      <VStack>
        <InputGroup>
          <InputLeftElement
            pointerEvents="none"
          >
            <BsFileEarmarkPlus />
          </InputLeftElement>
          <Input
            placeholder="Select a file..."
            value={filePath ? path.parse(filePath).base : ''}
            isReadOnly
            onClick={onButtonClick}
            isTruncated
            draggable={false}
            cursor="pointer"
            className="nodrag"
            disabled={isLocked}
          />
        </InputGroup>
        {filePath && (
        <Box>
          { preview() }
        </Box>
        )}
      </VStack>
    </>
  );
});

export default FileInput;
