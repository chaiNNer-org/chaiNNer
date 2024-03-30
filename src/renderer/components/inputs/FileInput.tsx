import {
    Icon,
    Input,
    InputGroup,
    InputLeftElement,
    MenuDivider,
    MenuItem,
    MenuList,
    Tooltip,
    VStack,
} from '@chakra-ui/react';
import { clipboard, shell } from 'electron/common';
import path from 'path';
import { DragEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFileEarmarkPlus } from 'react-icons/bs';
import { MdContentCopy, MdFolder } from 'react-icons/md';
import { useContext } from 'use-context-selector';
import { ipcRenderer } from '../../../common/safeIpc';
import { AlertBoxContext } from '../../contexts/AlertBoxContext';
import { getSingleFileWithExtension } from '../../helpers/dataTransfer';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useInputRefactor } from '../../hooks/useInputRefactor';
import { useLastDirectory } from '../../hooks/useLastDirectory';
import { WithLabel } from './InputContainer';
import { InputProps } from './props';

export const FileInput = memo(
    ({
        value: filePath,
        setValue: setFilePath,
        input,
        inputKey,
        isConnected,
        isLocked,
        nodeId,
    }: InputProps<'file', string>) => {
        const { t } = useTranslation();

        const { label, filetypes } = input;

        const { sendToast } = useContext(AlertBoxContext);

        const { lastDirectory, setLastDirectory } = useLastDirectory(inputKey);

        const onButtonClick = async () => {
            const fileDir = filePath ? path.dirname(filePath) : lastDirectory;
            const fileFilter = [
                {
                    name: label,
                    extensions: filetypes.map((e) => e.replace('.', '')),
                },
            ];
            const { canceled, filePaths } = await ipcRenderer.invoke(
                'file-select',
                fileFilter,
                false,
                fileDir
            );
            const selectedPath = filePaths[0];
            if (!canceled && selectedPath) {
                setFilePath(selectedPath);
                setLastDirectory(path.dirname(selectedPath));
            }
        };

        const onDragOver = (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            if (event.dataTransfer.types.includes('Files')) {
                event.stopPropagation();

                // eslint-disable-next-line no-param-reassign
                event.dataTransfer.dropEffect = 'move';
            }
        };

        const onDrop = (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();

            if (event.dataTransfer.types.includes('Files')) {
                event.stopPropagation();

                const p = getSingleFileWithExtension(event.dataTransfer, filetypes);
                if (p) {
                    setFilePath(p);
                    return;
                }

                if (event.dataTransfer.files.length !== 1) {
                    sendToast({
                        status: 'error',
                        description: `Only one file is accepted by ${label}.`,
                    });
                } else {
                    const ext = path.extname(event.dataTransfer.files[0].path);
                    sendToast({
                        status: 'error',
                        description: `${label} does not accept ${ext} files.`,
                    });
                }
            }
        };

        const refactor = useInputRefactor(nodeId, input, filePath, isConnected);

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<BsFileEarmarkPlus />}
                    isDisabled={isLocked || isConnected}
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    onClick={onButtonClick}
                >
                    {t('inputs.file.selectFile', 'Select a file...')}
                </MenuItem>
                <MenuDivider />
                <MenuItem
                    icon={<MdFolder />}
                    isDisabled={!filePath}
                    onClick={() => {
                        if (filePath) {
                            shell.showItemInFolder(filePath);
                        }
                    }}
                >
                    {t('inputs.file.openInFileExplorer', 'Open in File Explorer')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!filePath}
                    onClick={() => {
                        if (filePath) {
                            clipboard.writeText(path.parse(filePath).name);
                        }
                    }}
                >
                    {t('inputs.file.copyFileName', 'Copy File Name')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!filePath}
                    onClick={() => {
                        if (filePath) {
                            clipboard.writeText(filePath);
                        }
                    }}
                >
                    {t('inputs.file.copyFullFilePath', 'Copy Full File Path')}
                </MenuItem>
                {refactor}
            </MenuList>
        ));

        return (
            <WithLabel input={input}>
                <VStack
                    spacing={0}
                    onContextMenu={menu.onContextMenu}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                >
                    <Tooltip
                        borderRadius={8}
                        label={filePath}
                        maxW="auto"
                        openDelay={500}
                        px={2}
                        py={0}
                    >
                        <InputGroup size="sm">
                            <InputLeftElement pointerEvents="none">
                                <Icon
                                    as={BsFileEarmarkPlus}
                                    m={0}
                                />
                            </InputLeftElement>

                            <Input
                                isReadOnly
                                alt={filePath}
                                borderRadius="lg"
                                cursor="pointer"
                                disabled={isLocked || isConnected}
                                draggable={false}
                                placeholder="Click to select a file..."
                                size="sm"
                                textOverflow="ellipsis"
                                value={filePath ? path.parse(filePath).base : ''}
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                onClick={onButtonClick}
                            />
                        </InputGroup>
                    </Tooltip>
                </VStack>
            </WithLabel>
        );
    }
);
