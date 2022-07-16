import { Textarea } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputProps } from './props';

interface TextAreaInputProps extends InputProps {
    resizable: boolean;
}

export const TextAreaInput = memo(
    ({ label, inputId, useInputData, useInputSize, isLocked, resizable }: TextAreaInputProps) => {
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

        const [input, setInput] = useInputData<string>(inputId);
        const [size, setSize] = useInputSize(inputId);
        const [tempText, setTempText] = useState('');

        useEffect(() => {
            if (!size) {
                setSize({ width: 320, height: 240 });
            }
            if (!input) {
                setInput('');
            } else {
                setTempText(input);
            }
        }, []);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
            const text = event.target.value;
            setInput(text);
        }, 500);

        return (
            <Resizable
                className="nodrag"
                defaultSize={size}
                enable={{
                    top: false,
                    right: !isLocked && resizable && true,
                    bottom: !isLocked && resizable && true,
                    left: false,
                    topRight: false,
                    bottomRight: !isLocked && resizable && true,
                    bottomLeft: false,
                    topLeft: false,
                }}
                minHeight={80}
                minWidth={240}
                scale={zoom}
                onResizeStop={(e, direction, ref, d) => {
                    if (!isLocked) {
                        setSize({
                            width: (size?.width || 0) + d.width,
                            height: (size?.height || 0) + d.height,
                        });
                    }
                }}
            >
                <Textarea
                    className="nodrag"
                    disabled={isLocked}
                    draggable={false}
                    h="100%"
                    minW={240}
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
