import { Center, Input, MenuItem, MenuList, Textarea, Tooltip } from '@chakra-ui/react';
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
import { DragHandleSVG } from '../CustomIcons';
import { AutoLabel } from './InputContainer';
import { InputProps } from './props';

const DEFAULT_SIZE = { width: 222, height: 80 } as const;

const invalidRegexCache = new Map<string | null | undefined, RegExp | undefined>();
const getInvalidRegex = (pattern: string): RegExp | undefined => {
    if (!invalidRegexCache.has(pattern)) {
        try {
            invalidRegexCache.set(pattern, new RegExp(pattern, 'u'));
        } catch (e) {
            log.error('Invalid regex pattern:', pattern);
            invalidRegexCache.set(pattern, undefined);
        }
    }

    return invalidRegexCache.get(pattern);
};
const withGlobalFlag = (regex: RegExp): RegExp => {
    return new RegExp(regex.source, `${regex.flags}g`);
};
const removeInvalid = (text: string, invalidRegex: RegExp | undefined): string => {
    if (invalidRegex?.test(text)) {
        return text.replaceAll(withGlobalFlag(invalidRegex), '');
    }
    return text;
};

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
        const { label, multiline, maxLength, def, placeholder, allowEmptyString, invalidPattern } =
            input;
        const minLength = input.minLength ?? 0;
        const invalidRegex = invalidPattern ? getInvalidRegex(invalidPattern) : undefined;

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
                // eslint-disable-next-line no-param-reassign
                text = removeInvalid(text, invalidRegex);

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
            [minLength, maxLength, allowEmptyString, invalidRegex, setValue, resetValue]
        );
        const delayedInputValue = useDebouncedCallback((text: string) => {
            inputValue(text, true);
        }, 500);

        const [lastInvalidCharacter, setLastInvalidCharacter] = useState<string>();
        useEffect(() => {
            const timerId = setTimeout(() => {
                setLastInvalidCharacter(undefined);
            }, 5000);
            return () => clearTimeout(timerId);
        }, [lastInvalidCharacter]);

        const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            let text = event.target.value;
            const invalidChar = invalidRegex?.exec(text);
            if (invalidChar) {
                setLastInvalidCharacter(invalidChar[0]);
                text = removeInvalid(text, invalidRegex);
            }
            setTempText(text);
            delayedInputValue(text);
        };

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
                            navigator.clipboard.writeText(displayText).catch(log.error);
                        }
                    }}
                >
                    {t('inputs.text.copyText', 'Copy Text')}
                </MenuItem>
                <MenuItem
                    icon={<MdContentPaste />}
                    isDisabled={isConnected}
                    onClick={() => {
                        navigator.clipboard
                            .readText()
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
                    minWidth={DEFAULT_SIZE.width}
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
                        fontSize="14px"
                        h="100%"
                        maxLength={maxLength ?? undefined}
                        placeholder={placeholder ?? label}
                        px={3}
                        py={1}
                        resize="none"
                        value={displayText ?? ''}
                        w="full"
                        onChange={onChange}
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
                    onChange={onChange}
                    onContextMenu={menu.onContextMenu}
                />
            );
        }

        if (invalidRegex) {
            const codePoint = lastInvalidCharacter?.codePointAt(0) ?? 0;
            inputElement = (
                <Tooltip
                    isOpen={lastInvalidCharacter !== undefined}
                    label={`Invalid character '${lastInvalidCharacter ?? ''}' (U+${codePoint
                        .toString(16)
                        .padStart(4, '0')}).`}
                    onClose={() => setLastInvalidCharacter(undefined)}
                >
                    {inputElement}
                </Tooltip>
            );
        }

        return <AutoLabel input={input}>{inputElement}</AutoLabel>;
    }
);
