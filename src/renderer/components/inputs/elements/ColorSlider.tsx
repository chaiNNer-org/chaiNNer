import { HStack, Text } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { HsvColor, RgbColor } from 'react-colorful';
import { hsvToRgb, rgbToHex } from '../../../helpers/colorUtil';
import { AdvancedNumberInput } from './AdvanceNumberInput';
import { LINEAR_SCALE, SliderStyle, StyledSlider } from './StyledSlider';

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

const getRgbStyle = (color0: RgbColor, color255: RgbColor): SliderStyle => {
    return { type: 'gradient', gradient: [rgbToHex(color0), rgbToHex(color255)] };
};

interface RgbSlidersProps {
    rgb: RgbColor;
    onChange: (value: RgbColor) => void;
}
export const RgbSliders = memo(({ rgb, onChange }: RgbSlidersProps) => {
    return (
        <>
            <ColorSlider
                def={128}
                label="R"
                max={255}
                min={0}
                style={getRgbStyle({ ...rgb, r: 0 }, { ...rgb, r: 255 })}
                value={rgb.r}
                onChange={(r) => onChange({ ...rgb, r })}
            />
            <ColorSlider
                def={128}
                label="G"
                max={255}
                min={0}
                style={getRgbStyle({ ...rgb, g: 0 }, { ...rgb, g: 255 })}
                value={rgb.g}
                onChange={(g) => onChange({ ...rgb, g })}
            />
            <ColorSlider
                def={128}
                label="B"
                max={255}
                min={0}
                style={getRgbStyle({ ...rgb, b: 0 }, { ...rgb, b: 255 })}
                value={rgb.b}
                onChange={(b) => onChange({ ...rgb, b })}
            />
        </>
    );
});

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
                onChange={(h) => onChange({ ...hsv, h })}
            />
            <ColorSlider
                def={0}
                label="S"
                max={100}
                min={0}
                style={{
                    type: 'gradient',
                    gradient: [
                        rgbToHex(hsvToRgb({ ...hsv, s: 0 })),
                        rgbToHex(hsvToRgb({ ...hsv, s: 100 })),
                    ],
                }}
                value={hsv.s}
                onChange={(s) => onChange({ ...hsv, s })}
            />
            <ColorSlider
                def={50}
                label="V"
                max={100}
                min={0}
                style={{
                    type: 'gradient',
                    gradient: [
                        rgbToHex(hsvToRgb({ ...hsv, v: 0 })),
                        rgbToHex(hsvToRgb({ ...hsv, v: 100 })),
                    ],
                }}
                value={hsv.v}
                onChange={(v) => onChange({ ...hsv, v })}
            />
        </>
    );
});
