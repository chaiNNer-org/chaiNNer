import { Box } from '@chakra-ui/react';
import { memo, useMemo, useRef } from 'react';
import { RgbColorPicker as BuggedRgbColorPicker, RgbColor } from 'react-colorful';

export interface PickerProps<T> {
    color: T;
    onChange: (value: T) => void;
}

const rgbColorId = ({ r, g, b }: RgbColor): number => {
    return r * 256 * 256 + g * 256 + b;
};

export const RgbColorPicker = memo(({ color, onChange }: PickerProps<RgbColor>) => {
    // The react-colorful color picker has a pretty major bug: rounding.
    // It uses HSV internally to represent color, but it seems to round those values.
    // This results in the picker sometimes immediately changing the given input color.
    // This component fixes this behavior by detecting whether the onChange calls are
    // caused by the user interacting with the color picker or by this bug.

    const pickerRef = useRef<HTMLDivElement>(null);
    const pickerLastSet = useRef(0);

    // TODO: fix misuse of useMemo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const lastColorChange = useMemo(Date.now, [rgbColorId(color)]);

    return (
        <Box
            ref={pickerRef}
            w="full"
        >
            <BuggedRgbColorPicker
                color={color}
                onChange={(value) => {
                    const now = Date.now();
                    const sinceLastChange = now - lastColorChange;
                    const sinceLastSet = now - pickerLastSet.current;
                    if (
                        pickerRef.current?.matches(':focus-within') &&
                        (sinceLastSet < 200 || sinceLastChange > 200)
                    ) {
                        pickerLastSet.current = Date.now();
                        onChange(value);
                    }
                }}
            />
        </Box>
    );
});
