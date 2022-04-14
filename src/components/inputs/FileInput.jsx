import {
  Box, Input, InputGroup, InputLeftElement, Tooltip, VStack,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import { constants } from 'fs';
import { access } from 'fs/promises';
import path from 'path';
import {
  memo, useContext, useEffect,
} from 'react';
import { BsFileEarmarkPlus } from 'react-icons/bs';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';
import ImagePreview from './previews/ImagePreview.jsx';

const checkFileExists = (file) => new Promise((resolve) => access(file, constants.F_OK)
  .then(() => resolve(true))
  .catch(() => resolve(false)));

const FileInput = memo(({
  filetypes, id, index, label, type, isLocked, category, nodeType,
}) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [filePath, setFilePath] = useInputData(id, index);

  // Handle case of NCNN model selection where param and bin files are named in pairs
  // Eventually, these should be combined into a single input type instead of using
  // the file inputs directly
  if (label.toUpperCase().includes('NCNN') && label.toLowerCase().includes('bin')) {
    const [paramFilePath] = useInputData(id, index - 1);
    useEffect(() => {
      (async () => {
        if (paramFilePath) {
          const binFilePath = paramFilePath?.replace('.param', '.bin');
          const binFileExists = await checkFileExists(binFilePath);
          if (binFileExists) {
            setFilePath(paramFilePath?.replace('.param', '.bin'));
          }
        }
      })();
    }, [paramFilePath]);
  }
  if (label.toUpperCase().includes('NCNN') && label.toLowerCase().includes('param')) {
    const [binFilePath] = useInputData(id, index + 1);
    useEffect(() => {
      (async () => {
        if (binFilePath) {
          const paramFilePath = binFilePath?.replace('.param', '.bin');
          const paramFileExists = await checkFileExists(paramFilePath);
          if (paramFileExists) {
            setFilePath(paramFilePath?.replace('.bin', '.param'));
          }
        }
      })();
    }, [binFilePath]);
  }

  const [, , isInputLocked] = useNodeLock(id, index);

  const onButtonClick = async () => {
    const fileDir = filePath ? path.dirname(filePath) : undefined;
    const fileFilter = [{
      name: label,
      extensions: filetypes.map((e) => e.replace('.', '')) ?? ['*'],
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
            <ImagePreview
              category={category}
              id={id}
              nodeType={nodeType}
              path={filePath}
            />
          </Box>
        );
      default:
        return <></>;
    }
  };

  return (
    <VStack spacing={0}>
      <Tooltip
        borderRadius={8}
        label={filePath}
        maxW="auto"
        px={2}
        py={0}
      >
        <InputGroup>
          <InputLeftElement
            pointerEvents="none"
          >
            <BsFileEarmarkPlus />
          </InputLeftElement>

          <Input
            isReadOnly
            isTruncated
            alt={filePath}
            className="nodrag"
            cursor="pointer"
            disabled={isLocked || isInputLocked}
            draggable={false}
            placeholder="Select a file..."
            value={filePath ? path.parse(filePath).base : ''}
            onClick={onButtonClick}
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
