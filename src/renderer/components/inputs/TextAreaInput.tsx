import { Textarea } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { useMemoArray } from '../../hooks/useMemo';
import { InputProps } from './props';

interface TextAreaInputProps extends InputProps {
    resizable: boolean;
}

interface StringifiedValue {
    input: string;
    height: number;
    width: number;
}

export const TextAreaInput = memo(
    ({ label, inputId, useInputData, isLocked, resizable }: TextAreaInputProps) => {
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);
        const { useSnapToGrid } = useContext(SettingsContext);
        const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

        const [inputValue, setInputValue] = useInputData<string>(inputId);
        const [tempText, setTempText] = useState('');
        const [size, setSize] = useState({ width: 0, height: 0 });

        useEffect(() => {
            if (!inputValue) {
                setInputValue('');
                setSize({ width: 320, height: 240 });
            } else {
                try {
                    const { input, width, height } = JSON.parse(inputValue) as StringifiedValue;
                    setTempText(input);
                    setSize({ width, height });
                } catch (error) {
                    setInputValue(
                        JSON.stringify({
                            input: inputValue,
                            height: size.height,
                            width: size.width,
                        })
                    );
                }
            }
        }, []);

        const handleChange = useDebouncedCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
            const text = event.target.value;
            setInputValue(JSON.stringify({ input: text, height: size.height, width: size.width }));
        }, 500);

        return (
            <Resizable
                className="nodrag"
                defaultSize={size}
                enable={{
                    top: false,
                    right: resizable && true,
                    bottom: resizable && true,
                    left: false,
                    topRight: false,
                    bottomRight: resizable && true,
                    bottomLeft: false,
                    topLeft: false,
                }}
                grid={useMemoArray<[number, number]>(
                    isSnapToGrid ? [snapToGridAmount, snapToGridAmount] : [1, 1]
                )}
                minHeight={80}
                minWidth={240}
                scale={zoom}
                size={{
                    width: size.width,
                    height: size.height,
                }}
                onResizeStop={(e, direction, ref, d) => {
                    if (!isLocked) {
                        setSize({
                            width: size.width + d.width,
                            height: size.height + d.height,
                        });
                        setInputValue(
                            JSON.stringify({
                                input: tempText,
                                width: size.width + d.width,
                                height: size.height + d.height,
                            })
                        );
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
