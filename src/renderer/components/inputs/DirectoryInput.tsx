import {
    Input,
    InputGroup,
    InputLeftElement,
    MenuDivider,
    MenuItem,
    MenuList,
    Tooltip,
} from '@chakra-ui/react';
import { shell } from 'electron';
import { memo } from 'react';
import { BsFolderPlus } from 'react-icons/bs';
import { MdFolder } from 'react-icons/md';
import { useContextSelector } from 'use-context-selector';
import { ipcRenderer } from '../../../common/safeIpc';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useLastDirectory } from '../../hooks/useLastDirectory';
import { InputProps } from './props';

type DirectoryInputProps = InputProps;

const DirectoryInput = memo(
    ({ id, inputId, isLocked, useInputData, schemaId }: DirectoryInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            inputId
        );

        const [directory, setDirectory] = useInputData<string>(inputId);
        const { getLastDirectory, setLastDirectory } = useLastDirectory(`${schemaId} ${inputId}`);

        const onButtonClick = async () => {
            const { canceled, filePaths } = await ipcRenderer.invoke(
                'dir-select',
                directory ?? getLastDirectory() ?? ''
            );
            const path = filePaths[0];
            if (!canceled && path) {
                setDirectory(path);
                setLastDirectory(path);
            }
        };

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<BsFolderPlus />}
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    onClick={onButtonClick}
                >
                    Select a directory...
                </MenuItem>
                <MenuDivider />
                <MenuItem
                    icon={<MdFolder />}
                    isDisabled={!directory}
                    onClick={() => {
                        if (directory) {
                            shell.showItemInFolder(directory);
                        }
                    }}
                >
                    Open in File Explorer
                </MenuItem>
            </MenuList>
        ));

        return (
            <Tooltip
                borderRadius={8}
                label={isInputLocked ? undefined : directory}
                maxW="auto"
                openDelay={500}
                px={2}
                py={0}
            >
                <InputGroup onContextMenu={menu.onContextMenu}>
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
            </Tooltip>
        );
    }
);

export default DirectoryInput;
