import { Center, Input, MenuItem, MenuList, Textarea } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { log } from '../../../common/log';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { typeToString } from '../../helpers/naviHelpers';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useInputRefactor } from '../../hooks/useInputRefactor';
import { ipcRenderer } from '../../safeIpc';
import { DragHandleSVG } from '../CustomIcons';
import { AutoLabel } from './InputContainer';
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
        const { label, multiline, maxLength, def, placeholder, allowEmptyString } = input;
        const minLength = input.minLength ?? 0;

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
                } else if (minLength === 0 && allowEmptyString) {
                    setValue('');
                }
            }
        }, [value, def, minLength, allowEmptyString, setValue]);

        const inputValue = useCallback(
            (text: string, resetInvalid: boolean): void => {
                if (maxLength) {
                    // eslint-disable-next-line no-param-reassign
                    text = text.slice(0, maxLength);
                }

                if (text.length >= minLength && (text !== '' || allowEmptyString)) {
                    setValue(text);
                } else if (resetInvalid) {
                    resetValue();
                }
            },
            [minLength, maxLength, allowEmptyString, setValue, resetValue]
        );

        const handleChange = useDebouncedCallback(
            (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                inputValue(event.target.value, true);
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
        const refactor = useInputRefactor(nodeId, input, value, isConnected);

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!displayText}
                    onClick={() => {
                        if (displayText !== undefined) {
                            ipcRenderer.invoke('clipboard-writeText', displayText).catch(log.error);
                        }
                    }}
                >
                    {t('inputs.text.copyText', 'Copy Text')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentPaste />}
                    isDisabled={isConnected}
                    onClick={() => {
                        ipcRenderer
                            .invoke('clipboard-readText')
                            .then((clipboardValue) => {
                                // replace new lines
                                const text = clipboardValue.replace(
                                    /\r?\n|\r/g,
                                    multiline ? '\n' : ' '
                                );
                                if (text) {
                                    inputValue(text, false);
                                }
                            })
                            .catch(log.error);
                    }}
                >
                    {t('inputs.text.paste', 'Paste')}
                </MenuItem>
                {refactor}
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

        let inputElement;
        if (multiline) {
            inputElement = (
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
                    />
                </Resizable>
            );
        } else {
            inputElement = (
                <Input
                    borderRadius="lg"
                    className="nodrag"
                    disabled={isLocked || isConnected}
                    draggable={false}
                    htmlSize={1}
                    maxLength={maxLength ?? undefined}
                    placeholder={placeholder ?? label}
                    size="sm"
                    value={displayText ?? ''}
                    onChange={(event) => {
                        setTempText(event.target.value);
                        handleChange(event);
                    }}
                    onContextMenu={menu.onContextMenu}
                />
            );
        }

        return <AutoLabel input={input}>{inputElement}</AutoLabel>;
    }
);
