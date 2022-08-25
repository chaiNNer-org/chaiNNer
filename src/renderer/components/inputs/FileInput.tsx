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
import log from 'electron-log';
import path from 'path';
import { DragEvent, memo } from 'react';
import { BsFileEarmarkPlus } from 'react-icons/bs';
import { MdContentCopy, MdFolder } from 'react-icons/md';
import { useContext, useContextSelector } from 'use-context-selector';
import { InputId } from '../../../common/common-types';
import { ipcRenderer } from '../../../common/safeIpc';
import { checkFileExists } from '../../../common/util';
import { AlertBoxContext } from '../../contexts/AlertBoxContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getSingleFileWithExtension } from '../../helpers/dataTransfer';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useLastDirectory } from '../../hooks/useLastDirectory';
import { InputProps } from './props';

interface FileInputProps extends InputProps {
    filetypes: readonly string[];
}

const logError = (e: unknown) => log.error(e);

export const FileInput = memo(
    ({ filetypes, id, inputId, useInputData, label, isLocked, schemaId }: FileInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            inputId
        );
        const { sendToast } = useContext(AlertBoxContext);

        const [filePath, setFilePath] = useInputData<string>(inputId);

        const updateFilePath = async (file: string) => {
            // Handle case of NCNN model selection where param and bin files are named in pairs
            // Eventually, these should be combined into a single input type instead of using
            // the file inputs directly
            if (/NCNN/i.test(label)) {
                if (/bin/i.test(label)) {
                    const param = file.replace(/\.bin$/i, '.param');
                    if (await checkFileExists(param)) {
                        // eslint-disable-next-line react-hooks/rules-of-hooks
                        const [, setParamPath] = useInputData((inputId - 1) as InputId);
                        setParamPath(param);
                    }
                }
                if (/param/i.test(label)) {
                    const bin = file.replace(/\.param$/i, '.bin');
                    if (await checkFileExists(bin)) {
                        // eslint-disable-next-line react-hooks/rules-of-hooks
                        const [, setBinPath] = useInputData((inputId + 1) as InputId);
                        setBinPath(bin);
                    }
                }
            }

            setFilePath(file);
        };

        const { getLastDirectory, setLastDirectory } = useLastDirectory(`${schemaId} ${inputId}`);

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
                updateFilePath(selectedPath).catch(logError);
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
                    updateFilePath(p).catch(logError);
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
                    disabled={isLocked || isInputLocked}
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
                            disabled={isLocked || isInputLocked}
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
