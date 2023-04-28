import { Input, MenuItem, MenuList } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { useDebouncedCallback } from 'use-debounce';
import { stopPropagation } from '../../../common/util';
import { typeToString } from '../../helpers/naviHelpers';
import { useContextMenu } from '../../hooks/useContextMenu';
import { CopyOverrideIdSection } from './elements/CopyOverrideIdSection';
import { InputProps } from './props';

export const TextInput = memo(
    ({
        value,
        setValue,
        resetValue,
        input,
        isLocked,
        useInputConnected,
        useInputType,
        nodeId,
    }: InputProps<'text-line', string>) => {
        const { label, minLength, maxLength, def, placeholder } = input;

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

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLInputElement>) => {
            let text = event.target.value;
            text = maxLength ? text.slice(0, maxLength) : text;
            if (!minLength || text.length >= minLength) {
                setValue(text);
            } else {
                resetValue();
            }
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
                    isDisabled={isInputConnected}
                    onClick={() => {
                        let text = clipboard.readText();
                        // replace new lines with spaces
                        text = text.replace(/\r?\n|\r/g, ' ');
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

        return (
            <Input
                borderRadius="lg"
                className="nodrag"
                disabled={isLocked || isInputConnected}
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
