import {
    Box,
    Center,
    HStack,
    Heading,
    MenuItem,
    MenuList,
    Textarea,
    VStack,
} from '@chakra-ui/react';
import { clipboard } from 'electron';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { InputId, NodeData, Size } from '../../../../common/common-types';
import { GlobalVolatileContext } from '../../../contexts/GlobalNodeState';
import { useNodeStateFromData } from '../../../helpers/nodeState';
import { useContextMenu } from '../../../hooks/useContextMenu';
import { useDisabled } from '../../../hooks/useDisabled';
import { useNodeMenu } from '../../../hooks/useNodeMenu';
import { DragHandleSVG, IconFactory } from '../../CustomIcons';

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

const NoteNodeInner = memo(({ data, selected }: NodeProps) => {
    const nodeState = useNodeStateFromData(data);
    const { schema, setInputValue, inputData, inputHeight, setInputHeight, nodeWidth, setWidth } =
        nodeState;

    const targetRef = useRef<HTMLDivElement>(null);

    const disabled = useDisabled(data);
    const menu = useNodeMenu(data, disabled);

    const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

    const isLocked = false;

    const inputId = 0 as InputId;

    const size =
        inputHeight?.[inputId] && nodeWidth
            ? { height: inputHeight[inputId], width: nodeWidth }
            : DEFAULT_SIZE;

    const setSize = useCallback(
        (newSize: Readonly<Size>) => {
            setInputHeight(inputId, newSize.height);
            setWidth(newSize.width);
        },
        [inputId, setInputHeight, setWidth]
    );

    const startSize = useRef(DEFAULT_SIZE);

    const value = inputData[inputId];

    const [tempText, setTempText] = useState(value ?? '');

    const handleChange = useDebouncedCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setInputValue(inputId, event.target.value);
        },
        500
    );

    const { t } = useTranslation();

    const textAreaContextMenu = useContextMenu(() => (
        <MenuList className="nodrag">
            <MenuItem
                icon={<MdContentCopy />}
                onClick={() => {
                    if (value !== undefined) {
                        clipboard.writeText(value.toString());
                    }
                }}
            >
                {t('inputs.text.copyText', 'Copy Text')}
            </MenuItem>
            <MenuItem
                icon={<MdContentPaste />}
                onClick={() => {
                    let text = clipboard.readText();
                    // replace new lines
                    text = text.replace(/\r?\n|\r/g, '\n');
                    if (text) {
                        setInputValue(inputId, text);
                    }
                }}
            >
                {t('inputs.text.paste', 'Paste')}
            </MenuItem>
        </MenuList>
    ));

    return (
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
                        px={6}
                        py={2}
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
                                accentColor="yellow.500"
                                icon={schema.icon}
                            />
                        </Center>
                        <Center verticalAlign="middle">
                            <Heading
                                alignContent="center"
                                as="h5"
                                color="yellow.500"
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
                </Box>
                <Resizable
                    className="nodrag"
                    defaultSize={size ?? DEFAULT_SIZE}
                    enable={{
                        top: false,
                        right: !isLocked,
                        bottom: !isLocked,
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
                        backgroundImage="linear-gradient(transparent, transparent calc(3ch - 1px), green.200 0px)"
                        backgroundSize="100% 3ch"
                        borderRadius={0}
                        borderWidth={0}
                        className="nodrag"
                        color="gray.800"
                        disabled={isLocked}
                        draggable={false}
                        fontSize="sm"
                        h="100%"
                        lineHeight="3ch"
                        maxLength={undefined}
                        placeholder="Note Text"
                        px={2}
                        py={1}
                        resize="none"
                        textColor="gray.800"
                        value={tempText}
                        w="full"
                        onChange={(event) => {
                            setTempText(event.target.value);
                            handleChange(event);
                        }}
                        onContextMenu={textAreaContextMenu.onContextMenu}
                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                            e.stopPropagation();
                        }}
                    />
                </Resizable>
            </VStack>
        </Center>
    );
});
