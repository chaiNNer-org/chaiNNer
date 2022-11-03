import {
    Input,
    InputGroup,
    InputLeftElement,
    MenuDivider,
    MenuItem,
    MenuList,
    Tooltip,
    VStack,
} from '@chakra-ui/react';
import { clipboard, shell } from 'electron';
import path from 'path';
import { DragEvent, memo } from 'react';
import { BsFileEarmarkPlus } from 'react-icons/bs';
import { MdContentCopy, MdFolder } from 'react-icons/md';
import { useContext } from 'use-context-selector';
import { ipcRenderer } from '../../../common/safeIpc';
import { AlertBoxContext } from '../../contexts/AlertBoxContext';
import { getSingleFileWithExtension } from '../../helpers/dataTransfer';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useLastDirectory } from '../../hooks/useLastDirectory';
import { InputProps } from './props';

export const FileInput = memo(
    ({
        value: filePath,
        setValue: setFilePath,
        input,
        inputKey,
        useInputConnected,
        isLocked,
    }: InputProps<'file', string>) => {
        const { label, filetypes } = input;

        const isInputConnected = useInputConnected();
        const { sendToast } = useContext(AlertBoxContext);

        const { getLastDirectory, setLastDirectory } = useLastDirectory(inputKey);

        const onButtonClick = async () => {
            const fileDir = filePath ? path.dirname(filePath) : getLastDirectory();
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

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    disabled={isLocked || isInputConnected}
                    icon={<BsFileEarmarkPlus />}
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    onClick={onButtonClick}
                >
                    Select a file...
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
                    Open in File Explorer
                </MenuItem>
                <MenuDivider />
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!filePath}
                    onClick={() => {
                        if (filePath) {
                            clipboard.writeText(path.parse(filePath).name);
                        }
                    }}
                >
                    Copy File Name
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
                    Copy Full File Path
                </MenuItem>
            </MenuList>
        ));

        return (
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
                    <InputGroup>
                        <InputLeftElement pointerEvents="none">
                            <BsFileEarmarkPlus />
                        </InputLeftElement>

                        <Input
                            isReadOnly
                            alt={filePath}
                            className="nodrag"
                            cursor="pointer"
                            disabled={isLocked || isInputConnected}
                            draggable={false}
                            placeholder="Select a file..."
                            textOverflow="ellipsis"
                            value={filePath ? path.parse(filePath).base : ''}
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            onClick={onButtonClick}
                        />
                    </InputGroup>
                </Tooltip>
            </VStack>
        );
    }
);
