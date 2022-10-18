import { Type } from '@chainner/navi';
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
import { ipcRenderer } from '../../../common/safeIpc';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useLastDirectory } from '../../hooks/useLastDirectory';
import { NewInputProps } from './props';

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

export const DirectoryInput = memo(
    ({
        value,
        setValue,
        isLocked,
        inputKey,
        useInputLocked,
        useInputType,
    }: NewInputProps<'directory', string>) => {
        const { getLastDirectory, setLastDirectory } = useLastDirectory(inputKey);

        const onButtonClick = async () => {
            const { canceled, filePaths } = await ipcRenderer.invoke(
                'dir-select',
                value ?? getLastDirectory() ?? ''
            );
            const path = filePaths[0];
            if (!canceled && path) {
                setValue(path);
                setLastDirectory(path);
            }
        };

        const isInputLocked = useInputLocked();
        const inputType = useInputType();
        const displayDirectory = isInputLocked ? getDirectoryPath(inputType) : value;

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    disabled={isLocked || isInputLocked}
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
