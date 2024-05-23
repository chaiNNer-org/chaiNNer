import { HStack, Text } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { Color, HsvColor } from '../../../helpers/color';
import { LINEAR_SCALE } from '../../../helpers/sliderScale';
import { AdvancedNumberInput } from './AdvanceNumberInput';
import { SliderStyle, StyledSlider } from './StyledSlider';

interface ColorSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    def: number;
    min: number;
    max: number;
    precision?: number;
    style: SliderStyle;
}
export const ColorSlider = memo(
    ({ label, value, onChange, def, min, max, precision = 0, style }: ColorSliderProps) => {
        // eslint-disable-next-line no-param-reassign
        value = Number(value.toFixed(precision));

        const [inputString, setInputString] = useState(String(value));
        useEffect(() => {
            setInputString(String(value));
        }, [value]);

        const changeHandler = (n: number) => {
            if (min <= n && n <= max) {
                // eslint-disable-next-line no-param-reassign
                n = Number(n.toFixed(precision));
                if (n !== value) {
                    onChange(n);
                }
            }
        };

        const changeInputString = (s: string) => {
            if (s !== inputString) {
                setInputString(s);
                changeHandler(Number.parseFloat(s));
            }
        };

        const step = 1;

        return (
            <HStack w="full">
                <Text w={12}>{label}</Text>
                <StyledSlider
                    def={def}
                    max={max}
                    min={min}
                    scale={LINEAR_SCALE}
                    step={step}
                    style={style}
                    value={value}
                    onChange={changeHandler}
                    onChangeEnd={changeHandler}
                />
                <AdvancedNumberInput
                    noRepeatOnBlur
                    small
                    controlsStep={step}
                    defaultValue={def}
                    hideTrailingZeros={precision === 0}
                    inputString={inputString}
                    inputWidth="4.5rem"
                    max={max}
                    min={min}
                    precision={precision}
                    setInput={changeHandler}
                    setInputString={changeInputString}
                />
            </HStack>
        );
    }
);

const getRgbStyle = (color0: Color, color255: Color): SliderStyle => {
    return { type: 'gradient', gradient: [color0.hex(), color255.hex()] };
};

interface RgbSlidersProps {
    rgb: Color;
    onChange: (value: Color) => void;
}
export const RgbSliders = memo(({ rgb, onChange }: RgbSlidersProps) => {
    return (
        <>
            <ColorSlider
                def={128}
                label="R"
                max={255}
                min={0}
                style={getRgbStyle(rgb.with({ r: 0 }), rgb.with({ r: 255 }))}
                value={rgb.r}
                onChange={(r) => onChange(rgb.with({ r }))}
            />
            <ColorSlider
                def={128}
                label="G"
                max={255}
                min={0}
                style={getRgbStyle(rgb.with({ g: 0 }), rgb.with({ g: 255 }))}
                value={rgb.g}
                onChange={(g) => onChange(rgb.with({ g }))}
            />
            <ColorSlider
                def={128}
                label="B"
                max={255}
                min={0}
                style={getRgbStyle(rgb.with({ b: 0 }), rgb.with({ b: 255 }))}
                value={rgb.b}
                onChange={(b) => onChange(rgb.with({ b }))}
            />
        </>
    );
});

const getSvStyle = (color0: HsvColor, color255: HsvColor): SliderStyle => {
    return { type: 'gradient', gradient: [color0.rgb().hex(), color255.rgb().hex()] };
};

interface HsvSlidersProps {
    hsv: HsvColor;
    onChange: (value: HsvColor) => void;
}
export const HsvSliders = memo(({ hsv, onChange }: HsvSlidersProps) => {
    return (
        <>
            <ColorSlider
                def={0}
                label="H"
                max={360}
                min={0}
                style={{
                    type: 'gradient',
                    gradient: [
                        '#ff0000',
                        '#ffff00',
                        '#00ff00',
                        '#00ffff',
                        '#0000ff',
                        '#ff00ff',
                        '#ff0000',
                    ],
                }}
                value={hsv.h}
                onChange={(h) => onChange(hsv.with({ h }))}
            />
            <ColorSlider
                def={0}
                label="S"
                max={100}
                min={0}
                style={getSvStyle(hsv.with({ s: 0 }), hsv.with({ s: 100 }))}
                value={hsv.s}
                onChange={(s) => onChange(hsv.with({ s }))}
            />
            <ColorSlider
                def={50}
                label="V"
                max={100}
                min={0}
                style={getSvStyle(hsv.with({ v: 0 }), hsv.with({ v: 100 }))}
                value={hsv.v}
                onChange={(v) => onChange(hsv.with({ v }))}
            />
        </>
    );
});
