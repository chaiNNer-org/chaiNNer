import { MenuItem, MenuList, Textarea } from '@chakra-ui/react';
import { clipboard } from 'electron';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy, MdContentPaste } from 'react-icons/md';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { stopPropagation } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { useContextMenu } from '../../hooks/useContextMenu';
import { CopyOverrideIdSection } from './elements/CopyOverrideIdSection';
import { InputProps } from './props';

export const TextAreaInput = memo(
    ({ value, setValue, input, isLocked, useInputSize, nodeId }: InputProps<'text', string>) => {
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
                setSize({ width: 320, height: 240 });
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

        const { t } = useTranslation();

        const menu = useContextMenu(() => (
            <MenuList className="nodrag">
                <MenuItem
                    icon={<MdContentCopy />}
                    isDisabled={!tempText}
                    onClick={() => {
                        clipboard.writeText(tempText);
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

        return (
            <Resizable
                className="nodrag"
                defaultSize={size}
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
                minHeight={80}
                minWidth={240}
                scale={zoom}
                onResizeStop={(e, direction, ref, d) => {
                    if (!isLocked) {
                        setSize({
                            width: (size?.width ?? 0) + d.width,
                            height: (size?.height ?? 0) + d.height,
                        });
                    }
                }}
            >
                <Textarea
                    className="nodrag"
                    disabled={isLocked}
                    draggable={false}
                    h="100%"
                    placeholder={label}
                    resize="none"
                    value={tempText}
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
