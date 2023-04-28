import { Center, MenuItem, MenuList, Textarea } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { stopPropagation } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { typeToString } from '../../helpers/naviHelpers';
import { useContextMenu } from '../../hooks/useContextMenu';
import { DragHandleSVG } from '../CustomIcons';
import { CopyOverrideIdSection } from './elements/CopyOverrideIdSection';
import { InputProps } from './props';

const DEFAULT_SIZE = { width: 240, height: 80 };

export const TextAreaInput = memo(
    ({
        value,
        setValue,
        input,
        isLocked,
        useInputSize,
        nodeId,
        useInputConnected,
        useInputType,
    }: InputProps<'text', string>) => {
        const { label, resizable } = input;
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

        const [size, setSize] = useInputSize();
        const [tempText, setTempText] = useState(value ?? '');

        useEffect(() => {
            if (value !== undefined) {
                setTempText(value);
            }
        }, [value]);

        useEffect(() => {
            if (!size) {
                setSize(DEFAULT_SIZE);
            }
        }, [size, setSize]);

        useEffect(() => {
            if (!value) {
                setValue('');
            }
        }, [value, setValue]);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
            const text = event.target.value;
            setValue(text);
        }, 500);

        const isInputConnected = useInputConnected();
        const inputType = useInputType();
        const strType = inputType.underlying === 'number' ? typeToString(inputType) : inputType;
        const typeText =
            strType.underlying === 'string' && strType.type === 'literal'
                ? strType.value
                : undefined;
        const displayText = isInputConnected ? typeText : tempText;

        const { t } = useTranslation();

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!displayText}
                    onClick={() => {
                        if (displayText !== undefined) {
                            clipboard.writeText(displayText);
                        }
                    }}
                >
                    {t('inputs.text.copyText', 'Copy Text')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentPaste />}
                    onClick={() => {
                        const text = clipboard.readText();
                        if (text) {
                            setValue(text);
                        }
                    }}
                >
                    {t('inputs.text.paste', 'Paste')}
                </MenuItem>
                <CopyOverrideIdSection
                    inputId={input.id}
                    nodeId={nodeId}
                />
            </MenuList>
        ));

        const startSize = useRef(size ?? DEFAULT_SIZE);

        return (
            <Resizable
                className="nodrag"
                defaultSize={size ?? DEFAULT_SIZE}
                enable={{
                    top: false,
                    right: !isLocked && resizable,
                    bottom: !isLocked && resizable,
                    left: false,
                    topRight: false,
                    bottomRight: !isLocked && resizable,
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
                                color="var(--fg-300)"
                                opacity={0.75}
                            />
                        </Center>
                    ),
                }}
                minHeight={80}
                minWidth={240}
                scale={zoom}
                size={size}
                onResize={(e, direction, ref, d) => {
                    if (!isLocked) {
                        setSize({
                            width: startSize.current.width + d.width,
                            height: startSize.current.height + d.height,
                        });
                    }
                }}
                onResizeStart={() => {
                    startSize.current = size ?? DEFAULT_SIZE;
                }}
            >
                <Textarea
                    className="nodrag"
                    disabled={isLocked || isInputConnected}
                    draggable={false}
                    h="100%"
                    placeholder={label}
                    resize="none"
                    value={displayText ?? ''}
                    w="full"
                    onChange={(event) => {
                        setTempText(event.target.value);
                        handleChange(event);
                    }}
                    onContextMenu={menu.onContextMenu}
                    onKeyDown={stopPropagation}
                />
            </Resizable>
        );
    }
);
