import {
    Box,
    ButtonGroup,
    Center,
    HStack,
    Heading,
    Icon,
    IconButton,
    LightMode,
    MenuItem,
    MenuList,
    Spacer,
    Textarea,
    Tooltip,
    VStack,
} from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFillMarkdownFill, BsInputCursorText } from 'react-icons/bs';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { InputId, NodeData, Size } from '../../../../common/common-types';
import { log } from '../../../../common/log';
import { GlobalVolatileContext } from '../../../contexts/GlobalNodeState';
import { useNodeStateFromData } from '../../../helpers/nodeState';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { useNodeMenu } from '../../../hooks/useNodeMenu';
import { DragHandleSVG, IconFactory } from '../../CustomIcons';
import { Markdown } from '../../Markdown';

const DEFAULT_SIZE = { width: 240, height: 120 };

export const NoteNode = memo(({ data, selected }: NodeProps) => (
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    <NoteNodeInner
        data={data}
        selected={selected}
    />
));

export interface NodeProps {
    data: NodeData;
    selected: boolean;
}

enum EditorMode {
    Text,
    Md,
}

const noteScrollbarStyle = {
    '::-webkit-scrollbar': {
        width: '6px',
        borderRadius: '8px',
        backgroundColor: 'transparent',
    },
    '::-webkit-scrollbar-track': {
        borderRadius: '8px',
        width: '4px',
        marginRight: '2px',
    },
    '::-webkit-scrollbar-thumb': {
        borderRadius: '8px',
        backgroundColor: 'yellow.500',
        border: '2px solid transparent',
        cursor: 'pointer',
    },
    '::-webkit-scrollbar-corner': {
        background: ' rgba(0,0,0,0)',
    },
};

const NoteNodeInner = memo(({ data, selected }: NodeProps) => {
    const nodeState = useNodeStateFromData(data);
    const { schema, setInputValue, inputData, inputHeight, setInputHeight, nodeWidth, setWidth } =
        nodeState;

    const targetRef = useRef<HTMLDivElement>(null);

    const menu = useNodeMenu(data);

    const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

    const isLocked = false;

    const textInputId = 0 as InputId;
    const editorModeInputId = 1 as InputId;

    const size =
        inputHeight?.[textInputId] && nodeWidth
            ? { height: inputHeight[textInputId], width: nodeWidth }
            : DEFAULT_SIZE;

    const setSize = useCallback(
        (newSize: Readonly<Size>) => {
            setInputHeight(textInputId, newSize.height);
            setWidth(newSize.width);
        },
        [textInputId, setInputHeight, setWidth]
    );

    const startSize = useRef(DEFAULT_SIZE);

    const value = inputData[textInputId];

    const [tempText, setTempText] = useState(value ?? '');

    const handleChange = useDebouncedCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setInputValue(textInputId, event.target.value);
        },
        500
    );

    const [editorMode, setEditorMode] = useState(inputData[editorModeInputId] ?? EditorMode.Text);
    useEffect(() => {
        setInputValue(editorModeInputId, editorMode);
    }, [editorMode, setInputValue]);

    const { t } = useTranslation();
    const textAreaContextMenu = useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<MdContentCopy />}
                onClick={() => {
                    if (value !== undefined) {
                        navigator.clipboard.writeText(value.toString()).catch(log.error);
                    }
                }}
            >
                {t('inputs.text.copyText', 'Copy Text')}
            </MenuItem>
            <MenuItem
                icon={<MdContentPaste />}
                onClick={() => {
                    navigator.clipboard
                        .readText()
                        .then((clipboardValue) => {
                            // replace new lines
                            const text = clipboardValue.replace(/\r?\n|\r/g, '\n');
                            if (text) {
                                setInputValue(textInputId, text);
                            }
                        })
                        .catch(log.error);
                }}
            >
                {t('inputs.text.paste', 'Paste')}
            </MenuItem>
        </MenuList>
    ));

    return (
        <LightMode>
            <Center
                bg="#ffa"
                borderColor={selected ? 'yellow.400' : 'yellow.600'}
                borderRadius="2px 2px 6px 6px"
                borderWidth="0.5px"
                boxShadow="lg"
                minHeight="120px"
                minWidth="240px"
                overflow="hidden"
                ref={targetRef}
                transition="0.15s ease-in-out"
            >
                <VStack
                    spacing={0}
                    w="full"
                >
                    <Box
                        backgroundColor="yellow.300"
                        borderBottomRadius="2px"
                        borderBottomWidth={0}
                        boxShadow="0px 0px 8px 0px rgba(100, 80, 0, 0.5)"
                        w="full"
                        onContextMenu={menu.onContextMenu}
                    >
                        <HStack
                            px={2}
                            py={2}
                            verticalAlign="middle"
                        >
                            <HStack
                                pl={1}
                                verticalAlign="middle"
                            >
                                <Center
                                    alignContent="center"
                                    alignItems="center"
                                    h={4}
                                    verticalAlign="middle"
                                    w={4}
                                >
                                    <IconFactory
                                        accentColor="yellow.600"
                                        icon={schema.icon}
                                    />
                                </Center>
                                <Center verticalAlign="middle">
                                    <Heading
                                        alignContent="center"
                                        as="h5"
                                        color="yellow.600"
                                        fontWeight={700}
                                        lineHeight="auto"
                                        m={0}
                                        p={0}
                                        size="sm"
                                        textAlign="center"
                                        textTransform="uppercase"
                                        verticalAlign="middle"
                                        whiteSpace="nowrap"
                                    >
                                        {schema.name}
                                    </Heading>
                                </Center>
                            </HStack>
                            <Spacer />
                            <ButtonGroup
                                isAttached
                                colorScheme="yellow"
                                h={6}
                                size="sm"
                                variant="outline"
                            >
                                <Tooltip
                                    hasArrow
                                    borderRadius={8}
                                    label={t('note.editMode', 'Edit Mode')}
                                    mt={1}
                                    openDelay={500}
                                    px={2}
                                    py={1}
                                >
                                    <IconButton
                                        aria-label={t('note.editContent', 'Edit Content')}
                                        h={6}
                                        icon={
                                            <Icon
                                                as={BsInputCursorText}
                                                m={0}
                                                p={0}
                                            />
                                        }
                                        isActive={editorMode === EditorMode.Text}
                                        m={0}
                                        p={0}
                                        size="sm"
                                        onClick={() => {
                                            setEditorMode(EditorMode.Text);
                                        }}
                                    />
                                </Tooltip>
                                <Tooltip
                                    hasArrow
                                    borderRadius={8}
                                    label={t('note.markdownMode', 'Markdown Mode')}
                                    mt={1}
                                    openDelay={500}
                                    px={2}
                                    py={1}
                                >
                                    <IconButton
                                        aria-label={t('note.viewMarkdown', 'View Markdown')}
                                        h={6}
                                        icon={
                                            <Icon
                                                as={BsFillMarkdownFill}
                                                m={0}
                                                p={0}
                                            />
                                        }
                                        isActive={editorMode === EditorMode.Md}
                                        m={0}
                                        p={0}
                                        size="sm"
                                        onClick={() => {
                                            setEditorMode(EditorMode.Md);
                                        }}
                                    />
                                </Tooltip>
                            </ButtonGroup>
                        </HStack>
                    </Box>
                    <Resizable
                        className="nodrag"
                        defaultSize={size}
                        enable={{
                            top: false,
                            right: false,
                            bottom: false,
                            left: false,
                            topRight: false,
                            bottomRight: !isLocked,
                            bottomLeft: false,
                            topLeft: false,
                        }}
                        handleComponent={{
                            bottomRight: (
                                <Center
                                    cursor="nwse-resize"
                                    h="full"
                                    ml={-1}
                                    mt={-1}
                                    w="full"
                                >
                                    <DragHandleSVG
                                        color="yellow.600"
                                        opacity={0.75}
                                    />
                                </Center>
                            ),
                        }}
                        minHeight={120}
                        minWidth={240}
                        scale={zoom}
                        size={size}
                        onResize={(e, direction, ref, d) => {
                            setSize({
                                width: startSize.current.width + d.width,
                                height: startSize.current.height + d.height,
                            });
                        }}
                        onResizeStart={() => {
                            startSize.current = size;
                        }}
                    >
                        {editorMode === EditorMode.Text ? (
                            <Textarea
                                _active={{
                                    borderWidth: 0,
                                }}
                                _focus={{
                                    borderWidth: 0,
                                }}
                                _focusVisible={{
                                    borderWidth: 0,
                                }}
                                _placeholder={{
                                    color: 'yellow.300',
                                }}
                                _selected={{
                                    borderWidth: 0,
                                }}
                                backgroundAttachment="local"
                                backgroundImage="linear-gradient(transparent, transparent calc(3ch - 1px), green.200 0px)"
                                backgroundSize="100% 3ch"
                                borderRadius={0}
                                borderWidth={0}
                                className="nodrag nowheel"
                                color="gray.800"
                                disabled={isLocked}
                                draggable={false}
                                fontSize="sm"
                                h="100%"
                                lineHeight="3ch"
                                maxLength={undefined}
                                placeholder={t('node.note.placeholder', 'Note Text')}
                                px={2}
                                py={1}
                                resize="none"
                                sx={noteScrollbarStyle}
                                textColor="gray.800"
                                value={tempText}
                                w="full"
                                onChange={(event) => {
                                    setTempText(event.target.value);
                                    handleChange(event);
                                }}
                                onContextMenu={textAreaContextMenu.onContextMenu}
                            />
                        ) : (
                            <Box
                                className="nodrag nowheel"
                                color="gray.800"
                                h="full"
                                overflowY="scroll"
                                px={2}
                                py={1}
                                sx={noteScrollbarStyle}
                                textColor="gray.800"
                                w="full"
                                onContextMenu={textAreaContextMenu.onContextMenu}
                            >
                                <Markdown selectable={false}>{tempText.toString()}</Markdown>
                            </Box>
                        )}
                    </Resizable>
                </VStack>
            </Center>
        </LightMode>
    );
});
