import { NumberType } from '@chainner/navi';
import {
    Box,
    Slider,
    SliderFilledTrack,
    SliderThumb,
    SliderTrack,
    Text,
    Tooltip,
    useColorModeValue,
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
export class PowerScale implements Scale {
    public readonly power: number;

    public readonly min: number;

    public readonly precision: number;

    constructor(power: number, min: number, precision: number) {
        this.power = power;
        this.min = min;
        this.precision = precision;
    }

    toScale(value: number): number {
        return (value - this.min) ** this.power;
    }

    fromScale(scaledValue: number): number {
        const value = scaledValue ** (1 / this.power) + this.min;
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

        const borderColor = useColorModeValue('#E2E8F0', '#4F5765');
        const textColor = useColorModeValue('black', 'white');

        return (
            <Slider
                defaultValue={scale.toScale(def)}
                focusThumbOnChange={false}
                height={style.type === 'label' ? '28px' : '1em'}
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
                                background="var(--node-bg-color)"
                                border={`1px solid ${borderColor}`}
                                borderRadius="md"
                                cursor="pointer"
                                h="full"
                                position="absolute"
                                userSelect="none"
                                w="full"
                                zIndex={0}
                            />
                            <Box
                                alignItems="center"
                                cursor="pointer"
                                display="flex"
                                h="full"
                                p="1px"
                                position="absolute"
                                userSelect="none"
                                w="full"
                                zIndex={1}
                            >
                                <Text
                                    as="span"
                                    color={textColor}
                                    cursor="pointer"
                                    fontSize="14px"
                                    lineHeight="1.4em"
                                    overflow="hidden"
                                    pl={2}
                                    textOverflow="ellipsis"
                                    userSelect="none"
                                    w="full"
                                    whiteSpace="nowrap"
                                >
                                    {style.label}
                                </Text>
                            </Box>
                            <SliderFilledTrack
                                bg={borderColor}
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
                        cursor="pointer"
                        height="100%"
                        opacity={style.type === 'label' ? 0 : 1}
                        userSelect={style.type === 'label' ? 'none' : undefined}
                        width="8px"
                        zIndex={3}
                    />
                </Tooltip>
            </Slider>
        );
    }
);
