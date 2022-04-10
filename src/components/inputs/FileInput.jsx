/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
    Box, Input, InputGroup, InputLeftElement, Tooltip, VStack
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import path from 'path';
import React, {
    memo, useContext
} from 'react';
import { BsFileEarmarkPlus } from 'react-icons/bs';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';
import ImagePreview from './previews/ImagePreview.jsx';

const FileInput = memo(({
  filetypes, id, index, label, type, isLocked, category, nodeType,
}) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [filePath, setFilePath] = useInputData(id, index);

  const [, , isInputLocked] = useNodeLock(id, index);

  const onButtonClick = async () => {
    const fileDir = filePath ? path.dirname(filePath) : undefined;
    const fileFilter = [{
      name: label,
      extensions: filetypes ?? ['*'],
    }];
    const { canceled, filePaths } = await ipcRenderer.invoke('file-select', fileFilter, false, fileDir);
    const selectedPath = filePaths[0];
    if (!canceled && selectedPath) {
      setFilePath(selectedPath);
    }
  };

  const preview = () => {
    switch (type) {
      case 'file::image':
        return (
          <Box mt={2}>
            <ImagePreview path={filePath} category={category} nodeType={nodeType} id={id} />
          </Box>
        );
      default:
        return <></>;
    }
  };

  return (
    <VStack spacing={0}>
      <Tooltip
        label={filePath}
        borderRadius={8}
        py={0}
        px={2}
        maxW="auto"
      >
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
            alt={filePath}
          />

        </InputGroup>
      </Tooltip>
      {filePath && (
        <Box>
          { preview() }
        </Box>
      )}
    </VStack>
  );
});

export default FileInput;
