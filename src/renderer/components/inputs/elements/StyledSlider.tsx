import { NumberType } from '@chainner/navi';
import {
    Box,
    Slider,
    SliderFilledTrack,
    SliderThumb,
    SliderTrack,
    Text,
    Tooltip,
} from '@chakra-ui/react';
import { MouseEventHandler, memo, useMemo, useState } from 'react';
import { getTypeAccentColors } from '../../../helpers/accentColors';

export interface Scale {
    toScale(value: number): number;
    fromScale(scaledValue: number): number;
}
export const LINEAR_SCALE: Scale = { toScale: (n) => n, fromScale: (n) => n };
export class LogScale implements Scale {
    public readonly min: number;

    public readonly precision: number;

    constructor(min: number, precision: number) {
        this.min = min;
        this.precision = precision;
    }

    toScale(value: number): number {
        return Math.log1p(value - this.min);
    }

    fromScale(scaledValue: number): number {
        const value = Math.expm1(scaledValue) + this.min;
        return Number(value.toFixed(this.precision));
    }
}

interface OldLabelStyle {
    readonly type: 'old-label';
}
interface LabelStyle {
    readonly type: 'label';
    readonly label: string;
}
interface GradientStyle {
    readonly type: 'gradient';
    readonly gradient: readonly string[];
}
interface NoFillStyle {
    readonly type: 'no-fill';
}
interface AlphaStyle {
    readonly type: 'alpha';
    readonly color?: string;
}
export type SliderStyle = OldLabelStyle | LabelStyle | GradientStyle | NoFillStyle | AlphaStyle;

interface StyledSliderProps {
    style: SliderStyle;
    scale: Scale;
    isDisabled?: boolean;
    min: number;
    max: number;
    def: number;
    value: number;
    step: number;
    tooltip?: string;
    onChange: (value: number) => void;
    onChangeEnd: (value: number) => void;

    onContextMenu?: MouseEventHandler<HTMLElement> | undefined;
}
export const StyledSlider = memo(
    ({
        style,
        scale,
        isDisabled,
        min,
        max,
        def,
        value,
        step,
        tooltip,
        onChange,
        onChangeEnd,
        onContextMenu,
    }: StyledSliderProps) => {
        const [showTooltip, setShowTooltip] = useState(false);

        const [typeAccentColor] = useMemo(() => getTypeAccentColors(NumberType.instance), []);

        let customBackground;
        if (style.type === 'gradient') {
            customBackground = `linear-gradient(to right, ${style.gradient.join(', ')})`;
        } else if (style.type === 'alpha') {
            customBackground = [
                `linear-gradient(to right, transparent, ${style.color || 'black'})`,
                `repeating-conic-gradient(#AAA 0% 25%, #FFF 0% 50%) 50% / 20px 20px`,
            ].join(', ');
        }

        return (
            <Slider
                defaultValue={scale.toScale(def)}
                focusThumbOnChange={false}
                height={style.type === 'label' ? '1.4em' : '1em'}
                isDisabled={isDisabled}
                max={scale.toScale(max)}
                min={scale.toScale(min)}
                step={scale === LINEAR_SCALE ? step : 1e-10}
                value={scale.toScale(value)}
                onChange={(n) => onChange(scale.fromScale(n))}
                onChangeEnd={(n) => onChangeEnd(scale.fromScale(n))}
                onContextMenu={onContextMenu}
                onDoubleClick={() => onChangeEnd(def)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <SliderTrack
                    background={customBackground}
                    borderRadius="md"
                    cursor="pointer"
                    h="100%"
                >
                    {style.type === 'label' && (
                        <>
                            <Box
                                color="white"
                                cursor="pointer"
                                left={0}
                                position="absolute"
                                textAlign="center"
                                top={0}
                                userSelect="none"
                                width="100%"
                                zIndex={1}
                            >
                                <Text
                                    cursor="pointer"
                                    fontSize="14px"
                                    lineHeight="1.4em"
                                    textAlign="center"
                                    userSelect="none"
                                >
                                    {style.label}
                                </Text>
                            </Box>
                            <SliderFilledTrack
                                bg={typeAccentColor}
                                borderLeftRadius="md"
                                cursor="pointer"
                            />
                        </>
                    )}
                    {style.type === 'old-label' && (
                        <SliderFilledTrack
                            bg={typeAccentColor}
                            borderLeftRadius="md"
                            cursor="pointer"
                        />
                    )}
                </SliderTrack>
                <Tooltip
                    hasArrow
                    bg={typeAccentColor}
                    borderRadius={8}
                    color="white"
                    isOpen={showTooltip && !!tooltip}
                    label={tooltip}
                    placement="top"
                    px={2}
                    py={1}
                >
                    <SliderThumb
                        borderRadius="sm"
                        height="100%"
                        opacity={style.type === 'label' ? 0 : 1}
                        width="8px"
                        zIndex={3}
                    />
                </Tooltip>
            </Slider>
        );
    }
);
