import { Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import { memo, useContext } from 'react';
import { BsFolderPlus } from 'react-icons/bs';
import { ipcRenderer } from '../../helpers/safeIpc';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';

interface DirectoryInputProps {
    id: string;
    index: number;
    isLocked?: boolean;
}

const DirectoryInput = memo(({ id, index, isLocked }: DirectoryInputProps) => {
    const { useInputData, useNodeLock } = useContext(GlobalContext);
    const [directory, setDirectory] = useInputData<string>(id, index);
    const [, , isInputLocked] = useNodeLock(id, index);

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
