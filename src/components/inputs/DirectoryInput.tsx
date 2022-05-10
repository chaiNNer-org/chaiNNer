import { Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import { memo, useContext } from 'react';
import { BsFolderPlus } from 'react-icons/bs';
import { ipcRenderer } from '../../helpers/safeIpc';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';
import { InputProps } from './props';

type DirectoryInputProps = InputProps;

const DirectoryInput = memo(({ id, index, isLocked, useInputData }: DirectoryInputProps) => {
    const { isNodeInputLocked } = useContext(GlobalContext);

    const [directory, setDirectory] = useInputData<string>(index);
    const isInputLocked = isNodeInputLocked(id, index);

    const onButtonClick = async () => {
        const { canceled, filePaths } = await ipcRenderer.invoke('dir-select', directory ?? '');
        const path = filePaths[0];
        if (!canceled && path) {
            setDirectory(path);
        }
    };

    return (
        <InputGroup>
            <InputLeftElement pointerEvents="none">
                <BsFolderPlus />
            </InputLeftElement>
            <Input
                isReadOnly
                isTruncated
                className="nodrag"
                cursor="pointer"
                disabled={isLocked || isInputLocked}
                draggable={false}
                placeholder="Select a directory..."
                value={directory ?? ''}
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={onButtonClick}
            />
        </InputGroup>
    );
});

export default DirectoryInput;
