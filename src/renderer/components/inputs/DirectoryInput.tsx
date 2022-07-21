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
import { Type } from '../../../common/types/types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useLastDirectory } from '../../hooks/useLastDirectory';
import { InputProps } from './props';

const getDirectoryPath = (type: Type): string | undefined => {
    if (
        type.type === 'struct' &&
        type.name === 'Directory' &&
        type.fields.length > 0 &&
        type.fields[0].name === 'path'
    ) {
        const pathType = type.fields[0].type;
        if (pathType.underlying === 'string' && pathType.type === 'literal') {
            return pathType.value;
        }
    }
    return undefined;
};

type DirectoryInputProps = InputProps;

export const DirectoryInput = memo(
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

        const typeDirectory = useContextSelector(GlobalVolatileContext, (c) => {
            const type = c.typeState.functions.get(id)?.inputs.get(inputId);
            return type ? getDirectoryPath(type) : undefined;
        });
        const displayDirectory = isInputLocked ? typeDirectory : directory;

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
                    isDisabled={!displayDirectory}
                    onClick={() => {
                        if (displayDirectory) {
                            shell.showItemInFolder(displayDirectory);
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
                label={displayDirectory}
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
                        className="nodrag"
                        cursor="pointer"
                        disabled={isLocked || isInputLocked}
                        draggable={false}
                        placeholder="Select a directory..."
                        textOverflow="ellipsis"
                        value={displayDirectory ?? ''}
                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
                        onClick={onButtonClick}
                    />
                </InputGroup>
            </Tooltip>
        );
    }
);
