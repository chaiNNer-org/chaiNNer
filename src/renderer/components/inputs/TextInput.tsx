import { Center, Input, MenuItem, MenuList, Textarea } from '@chakra-ui/react';
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

export const TextInput = memo(
    ({
        value,
        setValue,
        resetValue,
        input,
        isConnected,
        isLocked,
        inputType,
        size,
        setSize,
        nodeId,
    }: InputProps<'text', string>) => {
        const { label, multiline, minLength, maxLength, def, placeholder } = input;

        const [tempText, setTempText] = useState(value ?? '');

        useEffect(() => {
            if (value !== undefined) {
                setTempText(value);
            }
        }, [value]);

        useEffect(() => {
            if (value === undefined) {
                if (def != null) {
                    setValue(def);
                } else if (minLength === 0) {
                    setValue('');
                }
            }
        }, [value, def, minLength, setValue]);

        const handleChange = useDebouncedCallback(
            (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                let text = event.target.value;
                text = maxLength ? text.slice(0, maxLength) : text;
                if (!minLength || text.length >= minLength) {
                    setValue(text);
                } else {
                    resetValue();
                }
            },
            500
        );

        const strType = inputType.underlying === 'number' ? typeToString(inputType) : inputType;
        const typeText =
            strType.underlying === 'string' && strType.type === 'literal'
                ? strType.value
                : undefined;
        const displayText = isConnected ? typeText : tempText;

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
                    isDisabled={isConnected}
                    onClick={() => {
                        let text = clipboard.readText();
                        // replace new lines
                        text = text.replace(/\r?\n|\r/g, multiline ? '\n' : ' ');
                        if (text) {
                            if (maxLength) {
                                text = text.slice(0, maxLength);
                            }
                            if (!minLength || text.length >= minLength) {
                                setValue(text);
                            }
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

        // size
        useEffect(() => {
            if (!size) {
                setSize(DEFAULT_SIZE);
            }
        }, [size, setSize]);

        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

        const startSize = useRef(size ?? DEFAULT_SIZE);

        if (multiline) {
            return (
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
                        disabled={isLocked || isConnected}
                        draggable={false}
                        h="100%"
                        maxLength={maxLength ?? undefined}
                        placeholder={placeholder ?? label}
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

        return (
            <Input
                borderRadius="lg"
                className="nodrag"
                disabled={isLocked || isConnected}
                draggable={false}
                maxLength={maxLength ?? undefined}
                placeholder={placeholder ?? label}
                size="sm"
                value={displayText ?? ''}
                onChange={(event) => {
                    setTempText(event.target.value);
                    handleChange(event);
                }}
                onContextMenu={menu.onContextMenu}
                onKeyDown={stopPropagation}
            />
        );
    }
);
