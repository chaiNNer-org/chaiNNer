/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { memo, useContext } from 'react';
import { BsFolderPlus } from 'react-icons/bs';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const DirectoryInput = memo(({ label, data, index }) => {
  const { id } = data;
  const { useInputData } = useContext(GlobalContext);
  const [directory, setDirectory] = useInputData(id, index);

  const onButtonClick = async () => {
    const { canceled, filePaths } = await ipcRenderer.invoke('dir-select', directory ?? '');
    const path = filePaths[0];
    if (!canceled && path) {
      setDirectory(path);
    }
  };

  return (
    <InputContainer id={id} index={index} label={label}>
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
        />
      </InputGroup>
    </InputContainer>
  );
});

export default DirectoryInput;
