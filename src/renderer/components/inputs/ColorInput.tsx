import {
    Box,
    Center,
    HStack,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverContent,
    PopoverTrigger,
    Portal,
    Spacer,
    Text,
    VStack,
} from '@chakra-ui/react';
import { ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RgbColor } from 'react-colorful';
import { toCssColor, toKind, toRgb } from '../../../common/color-json-util';
import {
    ColorJson,
    ColorKind,
    GrayscaleColorJson,
    RgbColorJson,
    RgbaColorJson,
} from '../../../common/common-types';
import { log } from '../../../common/log';
import { useColorModels } from '../../hooks/useColorModels';
import { TypeTags } from '../TypeTag';
import { ColorBoxButton } from './elements/ColorBoxButton';
import { ColorCompare } from './elements/ColorCompare';
import { ColorKindSelector } from './elements/ColorKindSelector';
import { HsvColorPicker } from './elements/ColorPicker';
import { ColorSlider, HsvSliders, RgbSliders } from './elements/ColorSlider';
import { RgbHexInput } from './elements/RgbHexInput';
import { WithoutLabel } from './InputContainer';
import { InputProps } from './props';

const ALL_KINDS: ReadonlySet<ColorKind> = new Set<ColorKind>(['grayscale', 'rgb', 'rgba']);

const KIND_SELECTOR_HEIGHT = '2rem';
const COMPARE_BUTTON_HEIGHT = '3rem';

const toRgbColor = (color: ColorJson): RgbColor => {
    if (color.kind === 'grayscale') {
        const l = Math.round(color.values[0] * 255);
        return { r: l, g: l, b: l };
    }
    const [r, g, b] = color.values;
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
};

interface RgbOrRgbaPickerProps extends Omit<PickerFor<ColorJson>, 'onChange'> {
    onChange: (color: RgbColor) => void;
    alpha?: ReactNode;
}
const RgbOrRgbaPicker = memo(
    ({ color, onChange, alpha, compare, kindSelector }: RgbOrRgbaPickerProps) => {
        const { rgb, hsv, changeRgb, changeHsv } = useColorModels(color, toRgbColor, onChange);

        return (
            <HStack
                alignItems="start"
                spacing={4}
            >
                <VStack
                    spacing={2}
                    w="12rem"
                >
                    {kindSelector}
                    {compare}
                    <HsvColorPicker
                        color={hsv}
                        onChange={changeHsv}
                    />
                </VStack>
                <VStack
                    spacing={2}
                    w="15rem"
                >
                    <Box
                        alignItems="end"
                        display="flex"
                        h={KIND_SELECTOR_HEIGHT}
                        w="full"
                    >
                        <RgbHexInput
                            rgb={rgb}
                            onChange={changeRgb}
                        />
                    </Box>
                    <VStack
                        spacing={0.5}
                        w="full"
                    >
                        <RgbSliders
                            rgb={rgb}
                            onChange={changeRgb}
                        />
                        {alpha || <Box h="1.5rem" />}
                    </VStack>
                    <VStack
                        spacing={0.5}
                        w="full"
                    >
                        <HsvSliders
                            hsv={hsv}
                            onChange={changeHsv}
                        />
                    </VStack>
                </VStack>
            </HStack>
        );
    }
);

interface PickerFor<C extends ColorJson> {
    color: C;
    onChange: (color: C) => void;
    compare: JSX.Element;
    kindSelector: JSX.Element | undefined;
}

const GrayPicker = memo(
    ({ color, onChange, compare, kindSelector }: PickerFor<GrayscaleColorJson>) => {
        const changeHandler = useCallback(
            (value: number) => {
                onChange({ kind: 'grayscale', values: [value / 255] });
            },
            [onChange]
        );
        const value = Math.round(color.values[0] * 255);

        return (
            <HStack spacing={4}>
                <VStack
                    spacing={2}
                    w="12rem"
                >
                    {kindSelector}
                    {compare}
                </VStack>
                <HStack
                    alignSelf="end"
                    h={COMPARE_BUTTON_HEIGHT}
                    w="15rem"
                >
                    <ColorSlider
                        def={128}
                        label="L"
                        max={255}
                        min={0}
                        style={{ type: 'gradient', gradient: ['black', 'white'] }}
                        value={value}
                        onChange={changeHandler}
                    />
                </HStack>
            </HStack>
        );
    }
);
const RgbaPicker = memo(
    ({ color, onChange, compare, kindSelector }: PickerFor<RgbColorJson | RgbaColorJson>) => {
        const originalAlpha = color.values[3];

        const onChangeRgb = useCallback(
            ({ r, g, b }: RgbColor): void => {
                if (originalAlpha !== undefined) {
                    onChange({ kind: 'rgba', values: [r / 255, g / 255, b / 255, originalAlpha] });
                } else {
                    onChange({ kind: 'rgb', values: [r / 255, g / 255, b / 255] });
                }
            },
            [onChange, originalAlpha]
        );

        let alpha;
        if (originalAlpha !== undefined) {
            alpha = (
                <ColorSlider
                    def={100}
                    label="A"
                    max={100}
                    min={0}
                    precision={1}
                    style={{ type: 'alpha', color: toCssColor(toRgb(color)) }}
                    value={Number((originalAlpha * 100).toFixed(1))}
                    onChange={(a: number): void => {
                        const [r, g, b] = color.values;
                        onChange({ kind: 'rgba', values: [r, g, b, a / 100] });
                    }}
                />
            );
        }

        return (
            <RgbOrRgbaPicker
                alpha={alpha}
                color={color}
                compare={compare}
                kindSelector={kindSelector}
                onChange={onChangeRgb}
            />
        );
    }
);

const ColorPickerContent = memo(
    ({
        color: outsideColor,
        onChange,
        kinds,
        internalColor,
    }: ColorPickerProps & { internalColor: React.MutableRefObject<ColorJson> }) => {
        // eslint-disable-next-line react/hook-use-state
        const [color, setColorInternal] = useState(outsideColor);
        const setColor = useCallback(
            (value: ColorJson): void => {
                setColorInternal(value);

                // eslint-disable-next-line no-param-reassign
                internalColor.current = value;
            },
            [internalColor]
        );
        useEffect(() => setColor(outsideColor), [outsideColor, setColor]);

        const kindSelector =
            kinds.size >= 2 ? (
                <ColorKindSelector
                    current={color.kind}
                    kinds={kinds}
                    onSelect={(k) => setColor(toKind(color, k))}
                />
            ) : undefined;

        const compare = (
            <ColorCompare
                newColor={color}
                oldColor={outsideColor}
                onNewClick={() => onChange(color)}
                onOldClick={() => setColor(outsideColor)}
            />
        );

        const Component = { grayscale: GrayPicker, rgb: RgbaPicker, rgba: RgbaPicker }[color.kind];
        return (
            <Component
                color={color as never}
                compare={compare}
                kindSelector={kindSelector}
                onChange={setColor}
            />
        );
    }
);

interface ColorPickerProps {
    color: ColorJson;
    onChange: (value: ColorJson) => void;
    kinds: ReadonlySet<ColorKind>;
}

const ColorPickerPopover = memo(({ color, onChange, kinds }: ColorPickerProps) => {
    const internalColor = useRef(color);

    return (
        <Popover
            isLazy
            placement="bottom-start"
            onClose={() => onChange(internalColor.current)}
        >
            <PopoverTrigger>
                <ColorBoxButton color={color} />
            </PopoverTrigger>
            <Portal>
                <PopoverContent
                    className="chainner-color-selector"
                    w="auto"
                >
                    <PopoverArrow />
                    <PopoverBody p={2}>
                        <ColorPickerContent
                            color={color}
                            internalColor={internalColor}
                            kinds={kinds}
                            onChange={onChange}
                        />
                    </PopoverBody>
                </PopoverContent>
            </Portal>
        </Popover>
    );
});

export const ColorInput = memo(
    ({
        value,
        setValue,
        input,
        definitionType,
        useInputConnected,
    }: InputProps<'color', string>) => {
        const { label, optional, def, channels } = input;

        const noValue = value === undefined;
        useEffect(() => {
            if (noValue) {
                setValue(def);
            }
        }, [noValue, setValue, def]);

        const current = value ?? def;
        const color = useMemo(() => {
            try {
                return JSON.parse(current) as ColorJson;
            } catch (error) {
                log.error(error);
                return undefined;
            }
        }, [current]);

        const invalidColor = !color;
        useEffect(() => {
            if (invalidColor) {
                // reset invalid colors
                setValue(def);
            }
        }, [invalidColor, setValue, def]);

        const connected = useInputConnected();
        const kinds = useMemo(() => {
            if (!channels) {
                return ALL_KINDS;
            }
            const k = new Set<ColorKind>();
            for (const c of channels) {
                if (c === 1) k.add('grayscale');
                if (c === 3) k.add('rgb');
                if (c === 4) k.add('rgba');
            }
            return k;
        }, [channels]);

        const onChange = useCallback(
            (newColor: ColorJson) => setValue(JSON.stringify(newColor)),
            [setValue]
        );

        return (
            <WithoutLabel>
                <Box
                    display="flex"
                    flexDirection="row"
                >
                    <Text>{label}</Text>
                    <Center>
                        <TypeTags
                            isOptional={optional}
                            type={definitionType}
                        />
                    </Center>
                    {!connected && color && (
                        <>
                            <Spacer />
                            <ColorPickerPopover
                                color={color}
                                kinds={kinds}
                                onChange={onChange}
                            />
                        </>
                    )}
                </Box>
            </WithoutLabel>
        );
    }
);
