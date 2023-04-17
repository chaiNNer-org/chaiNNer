import { Box } from '@chakra-ui/react';
import { memo, useMemo, useRef } from 'react';
import {
    HsvColorPicker as BuggedHsvColorPicker,
    RgbColorPicker as BuggedRgbColorPicker,
    HsvColor,
    RgbColor,
} from 'react-colorful';
import { hsvColorId, rgbColorId } from '../../../helpers/colorUtil';

interface PickerProps<T> {
    color: T;
    onChange: (value: T) => void;
}

export const RgbColorPicker = memo(({ color, onChange }: PickerProps<RgbColor>) => {
    // The react-colorful color picker has a pretty major bug: rounding.
    // It uses HSV internally to represent color, but it seems to round those values.
    // This results in the picker sometimes immediately changing the given input color.
    // This component fixes this behavior by detecting whether the onChange calls are
    // caused by the user interacting with the color picker or by this bug.

    const pickerRef = useRef<HTMLDivElement>(null);
    const pickerLastSet = useRef(0);

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

export const HsvColorPicker = memo(({ color, onChange }: PickerProps<HsvColor>) => {
    // The react-colorful color picker has a pretty major bug: rounding.
    // It uses HSV internally to represent color, but it seems to round those values.
    // This results in the picker sometimes immediately changing the given input color.
    // This component fixes this behavior by detecting whether the onChange calls are
    // caused by the user interacting with the color picker or by this bug.

    const pickerRef = useRef<HTMLDivElement>(null);
    const pickerLastSet = useRef(0);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const lastColorChange = useMemo(Date.now, [hsvColorId(color)]);

    return (
        <Box
            ref={pickerRef}
            w="full"
        >
            <BuggedHsvColorPicker
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
