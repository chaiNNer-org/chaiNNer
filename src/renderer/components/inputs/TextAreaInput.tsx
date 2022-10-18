import { Textarea } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputProps } from './props';

export const TextAreaInput = memo(
    ({ value, setValue, input, isLocked, useInputSize }: InputProps<'text', string>) => {
        const { label, resizable } = input;
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

        const [size, setSize] = useInputSize();
        const [tempText, setTempText] = useState('');

        useEffect(() => {
            if (!size) {
                setSize({ width: 320, height: 240 });
            }
            if (!value) {
                setValue('');
            } else {
                setTempText(value);
            }
        }, []);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
            const text = event.target.value;
            setValue(text);
        }, 500);

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
                />
            </Resizable>
        );
    }
);
