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
import { MouseEventHandler, memo, useState } from 'react';
import { LINEAR_SCALE, Scale } from '../../../helpers/sliderScale';
import { useTypeColor } from '../../../hooks/useTypeColor';

interface OldLabelStyle {
    readonly type: 'old-label';
}
interface LabelStyle {
    readonly type: 'label';
    readonly label: string;
    readonly unused?: boolean;
    readonly gradient?: readonly string[];
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

const getLinearGradient = (gradient: readonly string[]) => {
    return `linear-gradient(to right, ${gradient.join(', ')})`;
};

const getSliderHeight = (style: SliderStyle) => {
    if (style.type === 'label') {
        return style.gradient ? '32px' : '28px';
    }
    return '1em';
};

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

        const [typeAccentColor] = useTypeColor(NumberType.instance);

        let customBackground;
        if (style.type === 'gradient') {
            customBackground = getLinearGradient(style.gradient);
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
                height={getSliderHeight(style)}
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
                            {style.gradient && (
                                <>
                                    <Box
                                        background={getLinearGradient(style.gradient)}
                                        border={`1px solid ${borderColor}`}
                                        borderBottomRadius="md"
                                        borderTop="none"
                                        bottom={0}
                                        cursor="pointer"
                                        h="4px"
                                        left={0}
                                        p="1px"
                                        position="absolute"
                                        right={0}
                                        userSelect="none"
                                        zIndex={1}
                                    />
                                    <Box
                                        border={`1px solid ${borderColor}`}
                                        borderRadius="md"
                                        cursor="pointer"
                                        h="full"
                                        position="absolute"
                                        userSelect="none"
                                        w="full"
                                        zIndex={1}
                                    />
                                </>
                            )}
                            <Box
                                alignItems="center"
                                cursor="pointer"
                                display="flex"
                                h="full"
                                p="1px"
                                pb={style.gradient && '3px'}
                                position="absolute"
                                userSelect="none"
                                w="full"
                                zIndex={2}
                            >
                                <Text
                                    as="span"
                                    color={textColor}
                                    cursor="pointer"
                                    fontSize="14px"
                                    lineHeight="1.4em"
                                    opacity={style.unused ? 0.7 : undefined}
                                    overflow="hidden"
                                    pl={2}
                                    textDecoration={style.unused ? 'line-through' : undefined}
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
                            <SliderFilledTrack
                                bg="transparent"
                                borderRight={
                                    min < value && value < max
                                        ? `1px solid ${textColor}`
                                        : undefined
                                }
                                cursor="pointer"
                                opacity={0.5}
                                zIndex={3}
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
