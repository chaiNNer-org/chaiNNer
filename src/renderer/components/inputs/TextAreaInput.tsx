import { Textarea } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { ChangeEvent, memo, useEffect, useState } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { Size } from '../../../common/common-types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { useMemoArray } from '../../hooks/useMemo';
import { InputProps } from './props';

interface TextAreaInputProps extends InputProps {
    resizable: boolean;
}

export const TextAreaInput = memo(
    ({ label, inputId, useInputData, useInputSize, isLocked, resizable }: TextAreaInputProps) => {
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);
        const { useSnapToGrid } = useContext(SettingsContext);
        const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

        const [input, setInput] = useInputData<string>(inputId);
        const [size, setSize] = useInputSize<Size>(inputId);
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
                grid={useMemoArray<[number, number]>(
                    isSnapToGrid ? [snapToGridAmount, snapToGridAmount] : [1, 1]
                )}
                minHeight={80}
                minWidth={240}
                scale={zoom}
                size={{
                    width: size?.width || 320,
                    height: size?.height || 240,
                }}
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
