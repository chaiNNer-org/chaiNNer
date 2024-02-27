import { Type, isStringLiteral } from '@chainner/navi';
import {
    Icon,
    Input,
    InputGroup,
    InputLeftElement,
    MenuDivider,
    MenuItem,
    MenuList,
    Tooltip,
} from '@chakra-ui/react';
import { clipboard, shell } from 'electron';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFolderPlus } from 'react-icons/bs';
import { MdContentCopy, MdFolder } from 'react-icons/md';
import { ipcRenderer } from '../../../common/safeIpc';
import { getFields, isDirectory } from '../../../common/types/util';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useInputRefactor } from '../../hooks/useInputRefactor';
import { useLastDirectory } from '../../hooks/useLastDirectory';
import { AutoLabel } from './InputContainer';
import { InputProps } from './props';

const getDirectoryPath = (type: Type): string | undefined => {
    if (isDirectory(type)) {
        const { path } = getFields(type);
        if (isStringLiteral(path)) {
            return path.value;
        }
    }
    return undefined;
};

export const DirectoryInput = memo(
    ({
        value,
        setValue,
        isLocked,
        input,
        inputKey,
        isConnected,
        inputType,
        nodeId,
    }: InputProps<'directory', string>) => {
        const { t } = useTranslation();

        const { lastDirectory, setLastDirectory } = useLastDirectory(inputKey);

        const onButtonClick = async () => {
            const { canceled, filePaths } = await ipcRenderer.invoke(
                'dir-select',
                value ?? lastDirectory ?? ''
            );
            const path = filePaths[0];
            if (!canceled && path) {
                setValue(path);
                setLastDirectory(path);
            }
        };

        const displayDirectory = isConnected ? getDirectoryPath(inputType) : value;

        const refactor = useInputRefactor(nodeId, input, value, isConnected);

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<BsFolderPlus />}
                    isDisabled={isLocked || isConnected}
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    onClick={onButtonClick}
                >
                    {t('inputs.directory.selectDirectory', 'Select a directory...')}
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
                    {t('inputs.directory.openInFileExplorer', 'Open in File Explorer')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!displayDirectory}
                    onClick={() => {
                        if (displayDirectory) {
                            clipboard.writeText(displayDirectory);
                        }
                    }}
                >
                    {t('inputs.directory.copyFullDirectoryPath', 'Copy Full Directory Path')}
                </MenuItem>
                {refactor}
            </MenuList>
        ));

        return (
            <AutoLabel input={input}>
                <Tooltip
                    borderRadius={8}
                    label={displayDirectory}
                    maxW="auto"
                    openDelay={500}
                    px={2}
                    py={0}
                >
                    <InputGroup
                        size="sm"
                        onContextMenu={menu.onContextMenu}
                    >
                        <InputLeftElement pointerEvents="none">
                            <Icon
                                as={BsFolderPlus}
                                m={0}
                            />
                        </InputLeftElement>
                        <Input
                            isReadOnly
                            borderRadius="lg"
                            cursor="pointer"
                            disabled={isLocked || isConnected}
                            draggable={false}
                            htmlSize={1}
                            placeholder="Click to select..."
                            size="sm"
                            textOverflow="ellipsis"
                            value={displayDirectory ?? ''}
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            onClick={onButtonClick}
                        />
                    </InputGroup>
                </Tooltip>
            </AutoLabel>
        );
    }
);
