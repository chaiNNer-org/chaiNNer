/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { memo, useContext } from 'react';
import { BsFolderPlus } from 'react-icons/bs';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const DirectoryInput = memo(({ label, id, index }) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [directory, setDirectory] = useInputData(id, index);
  const [isLocked] = useNodeLock(id);

  const onButtonClick = async () => {
    const { canceled, filePaths } = await ipcRenderer.invoke('dir-select', directory ?? '');
    const path = filePaths[0];
    if (!canceled && path) {
      setDirectory(path);
    }
  };

  return (
    <InputGroup>
      <InputLeftElement
        pointerEvents="none"
      >
        <BsFolderPlus />
      </InputLeftElement>
      <Input
        placeholder="Select a directory..."
        value={directory ?? ''}
        isReadOnly
        onClick={onButtonClick}
        isTruncated
        draggable={false}
        cursor="pointer"
        className="nodrag"
        disabled={isLocked}
      />
    </InputGroup>
  );
});

export default DirectoryInput;
