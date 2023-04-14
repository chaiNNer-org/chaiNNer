import {
    Box,
    Button,
    ButtonGroup,
    Center,
    HStack,
    Input,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverContent,
    PopoverTrigger,
    Portal,
    Spacer,
    Text,
    Tooltip,
    VStack,
} from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RgbColor, RgbaColor } from 'react-colorful';
import { rgb as rgbContrast } from 'wcag-contrast';
import {
    ColorJson,
    GrayscaleColorJson,
    OfKind,
    RgbColorJson,
    RgbaColorJson,
} from '../../../common/common-types';
import { assertNever, stopPropagation } from '../../../common/util';
import { TypeTags } from '../TypeTag';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { PickerProps, RgbColorPicker } from './elements/RgbColorPicker';
import { LINEAR_SCALE, StyledSlider } from './elements/StyledSlider';
import { WithoutLabel } from './InputContainer';
import { InputProps } from './props';

type ColorKind = ColorJson['kind'];
const ALL_KINDS: ReadonlySet<ColorKind> = new Set<ColorKind>(['grayscale', 'rgb', 'rgba']);

interface ColorBoxProps {
    color: ColorJson;
    onChange: (value: ColorJson) => void;
    kinds: ReadonlySet<ColorKind>;
}
const toCssColor = (color: ColorJson): string => {
    switch (color.kind) {
        case 'grayscale': {
            const [luma] = color.values;
            return `rgb(${luma * 255} ${luma * 255} ${luma * 255})`;
        }
        case 'rgb': {
            const [r, g, b] = color.values;
            return `rgb(${r * 255} ${g * 255} ${b * 255})`;
        }
        case 'rgba': {
            const [r, g, b, a] = color.values;
            return `rgb(${r * 255} ${g * 255} ${b * 255} / ${a})`;
        }
        default:
            return assertNever(color);
    }
};
const to8Bit = (n: number): string => String(Math.round(n * 255));
const toPercent = (n: number): string => `${String(Math.round(n * 100))}%`;
const to8BitHex = (r: number, g: number, b: number): string => {
    // eslint-disable-next-line no-param-reassign
    r = Math.round(r * 255);
    // eslint-disable-next-line no-param-reassign
    g = Math.round(g * 255);
    // eslint-disable-next-line no-param-reassign
    b = Math.round(b * 255);

    return (r * 256 * 256 + g * 256 + b).toString(16).padStart(6, '0').toUpperCase();
};
const toDisplayText = (color: ColorJson): string => {
    switch (color.kind) {
        case 'grayscale': {
            const [luma] = color.values;
            return to8Bit(luma);
        }
        case 'rgb': {
            const [r, g, b] = color.values;
            return `${to8Bit(r)} ${to8Bit(g)} ${to8Bit(b)}`;
        }
        case 'rgba': {
            const [r, g, b, a] = color.values;
            return `${to8BitHex(r, g, b)} ${toPercent(a)}`;
        }
        default:
            return assertNever(color);
    }
};
const withBg = (fg: RgbaColorJson, bg: RgbColorJson): RgbColorJson => {
    const a = fg.values[3];
    return {
        kind: 'rgb',
        values: [
            fg.values[0] * a + bg.values[0] * (1 - a),
            fg.values[1] * a + bg.values[1] * (1 - a),
            fg.values[2] * a + bg.values[2] * (1 - a),
        ],
    };
};
const getTextColorFor = (color: ColorJson): 'white' | 'black' => {
    let rgb: [number, number, number];
    if (color.kind === 'grayscale') {
        const luma = color.values[0] * 255;
        rgb = [luma, luma, luma];
    } else {
        if (color.kind === 'rgba') {
            // eslint-disable-next-line no-param-reassign
            color = withBg(color, { kind: 'rgb', values: [0.9, 0.9, 0.9] });
        }
        const [r, g, b] = color.values;
        rgb = [r * 255, g * 255, b * 255];
    }

    const cBlack = rgbContrast(rgb, [0, 0, 0]);
    const cWhite = rgbContrast(rgb, [255, 255, 255]);
    return cBlack > cWhite ? 'black' : 'white';
};
const BG1: RgbColorJson = { kind: 'rgb', values: [0.8, 0.8, 0.8] };
const BG2: RgbColorJson = { kind: 'rgb', values: [1, 1, 1] };
const getCssBackground = (color: ColorJson): string => {
    if (color.kind === 'rgba' && color.values[3] < 1) {
        return `repeating-conic-gradient(${toCssColor(withBg(color, BG1))} 0% 25%, ${toCssColor(
            withBg(color, BG2)
        )} 0% 50%) 0 0 / 20px 20px`;
    }
    return `${toCssColor(color)}`;
};

const toRgbaColor = (color: ColorJson): RgbaColor => {
    if (color.kind === 'grayscale') {
        const l = color.values[0] * 255;
        return { r: l, g: l, b: l, a: 1 };
    }
    const [r, g, b] = color.values;
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
        a: color.kind === 'rgba' ? color.values[3] : 1,
    };
};
const toRgbColor = (color: ColorJson): RgbColor => {
    const { r, g, b } = toRgbaColor(color);
    return { r, g, b };
};
const parseHex = (hex: string): RgbColor | undefined => {
    if (!/^[0-9a-fA-F]+$/.test(hex)) return undefined;
    if (hex.length === 3) {
        const r = Number.parseInt(hex[0], 16) * 17;
        const g = Number.parseInt(hex[1], 16) * 17;
        const b = Number.parseInt(hex[2], 16) * 17;
        return { r, g, b };
    }
    if (hex.length === 6) {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return { r, g, b };
    }
    return undefined;
};
const rgbToHex = ({ r, g, b }: RgbColor): string => {
    return to8BitHex(r / 255, g / 255, b / 255);
};
const rgbToCssHex = (color: RgbColor): string => {
    return `#${rgbToHex(color)}`;
};

interface Slider8BitProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    color0: string;
    color255: string;
}
const Slider8Bit = memo(({ label, value, onChange, color0, color255 }: Slider8BitProps) => {
    const def = 128;
    const min = 0;
    const max = 255;
    const step = 1;

    const [inputString, setInputString] = useState(String(value));
    useEffect(() => {
        setInputString(String(value));
    }, [value]);

    const changeHandler = (n: number) => {
        if (n !== value && min <= n && n <= max) {
            onChange(n);
        }
    };

    const changeInputString = (s: string) => {
        setInputString(s);
        changeHandler(Number.parseInt(s, 10));
    };

    return (
        <HStack w="full">
            <Text w={12}>{label}</Text>
            <StyledSlider
                def={def}
                max={max}
                min={min}
                scale={LINEAR_SCALE}
                step={step}
                style={{ type: 'gradient', gradient: [color0, color255] }}
                value={value}
                onChange={changeHandler}
                onChangeEnd={changeHandler}
            />
            <AdvancedNumberInput
                small
                controlsStep={step}
                defaultValue={def}
                hideTrailingZeros={false}
                inputString={inputString}
                inputWidth="4rem"
                max={max}
                min={min}
                precision={0}
                setInput={changeHandler}
                setInputString={changeInputString}
            />
        </HStack>
    );
});

interface SliderAlphaProps {
    value: number;
    onChange: (value: number) => void;
    color?: string;
}
const SliderAlpha = memo(({ value, onChange, color }: SliderAlphaProps) => {
    const def = 100;
    const min = 0;
    const max = 100;
    const step = 1;

    const [inputString, setInputString] = useState(String(value));
    useEffect(() => {
        setInputString(String(value));
    }, [value]);

    const changeHandler = (n: number) => {
        if (n !== value && min <= n && n <= max) {
            onChange(n);
        }
    };

    const changeInputString = (s: string) => {
        setInputString(s);
        changeHandler(Number.parseFloat(s));
    };

    return (
        <HStack w="full">
            <Text w={12}>A</Text>
            <StyledSlider
                def={def}
                max={max}
                min={min}
                scale={LINEAR_SCALE}
                step={step}
                style={{ type: 'alpha', color }}
                value={value}
                onChange={changeHandler}
                onChangeEnd={changeHandler}
            />
            <AdvancedNumberInput
                small
                controlsStep={step}
                defaultValue={def}
                hideTrailingZeros={false}
                inputString={inputString}
                inputWidth="4rem"
                max={max}
                min={min}
                precision={1}
                setInput={changeHandler}
                setInputString={changeInputString}
            />
        </HStack>
    );
});

interface RgbHexInputProps {
    rgb: RgbColor;
    onChange: (value: RgbColor) => void;
}
const RgbHexInput = memo(({ rgb, onChange }: RgbHexInputProps) => {
    const currentHex = rgbToHex(rgb);

    const [inputString, setInputString] = useState(currentHex);
    useEffect(() => {
        setInputString((old) => {
            const parsed = parseHex(old);
            if (parsed && rgbToHex(parsed) === currentHex) {
                return old;
            }
            return currentHex;
        });
    }, [currentHex]);

    const changeInputString = (s: string) => {
        setInputString(s);

        const parsed = parseHex(s);
        if (parsed && rgbToHex(parsed) !== currentHex) {
            onChange(parsed);
        }
    };

    return (
        <HStack w="full">
            <Text>Hex</Text>
            <Spacer />
            <Input
                borderRadius="md"
                className="nodrag"
                draggable={false}
                maxLength={12}
                p={1}
                size="xs"
                textTransform="uppercase"
                value={inputString}
                w="4rem"
                onChange={(event) => changeInputString(event.target.value)}
                onKeyDown={stopPropagation}
            />
        </HStack>
    );
});

interface RgbSlidersProps {
    rgb: RgbColor;
    onChange: (value: RgbColor) => void;
}
const RgbSliders = memo(({ rgb, onChange }: RgbSlidersProps) => {
    return (
        <>
            <Slider8Bit
                color0={rgbToCssHex({ ...rgb, r: 0 })}
                color255={rgbToCssHex({ ...rgb, r: 255 })}
                label="R"
                value={rgb.r}
                onChange={(r) => onChange({ ...rgb, r })}
            />
            <Slider8Bit
                color0={rgbToCssHex({ ...rgb, g: 0 })}
                color255={rgbToCssHex({ ...rgb, g: 255 })}
                label="G"
                value={rgb.g}
                onChange={(g) => onChange({ ...rgb, g })}
            />
            <Slider8Bit
                color0={rgbToCssHex({ ...rgb, b: 0 })}
                color255={rgbToCssHex({ ...rgb, b: 255 })}
                label="B"
                value={rgb.b}
                onChange={(b) => onChange({ ...rgb, b })}
            />
        </>
    );
});

const GrayPicker = memo(({ color, onChange }: PickerProps<GrayscaleColorJson>) => {
    const changeHandler = useCallback(
        (value: number) => {
            onChange({ kind: 'grayscale', values: [value / 255] });
        },
        [onChange]
    );
    const value = Math.round(color.values[0] * 255);

    return (
        <Box mt={2}>
            <Slider8Bit
                color0="black"
                color255="white"
                label="L"
                value={value}
                onChange={changeHandler}
            />
        </Box>
    );
});
const RgbPicker = memo(({ color, onChange }: PickerProps<RgbColorJson>) => {
    const rgb = toRgbColor(color);

    const changeHandler = ({ r, g, b }: RgbColor): void => {
        onChange({ kind: 'rgb', values: [r / 255, g / 255, b / 255] });
    };

    return (
        <>
            <Box mt={2}>
                <RgbColorPicker
                    color={rgb}
                    onChange={changeHandler}
                />
            </Box>
            <VStack
                mt={2}
                spacing={0.5}
            >
                <RgbSliders
                    rgb={rgb}
                    onChange={changeHandler}
                />
                <RgbHexInput
                    rgb={rgb}
                    onChange={changeHandler}
                />
            </VStack>
        </>
    );
});
const RgbaPicker = memo(({ color, onChange }: PickerProps<RgbaColorJson>) => {
    const rgb = toRgbColor(color);
    const alpha = Number((color.values[3] * 100).toFixed(1));

    const changeHandler = ({ r, g, b }: RgbColor): void => {
        onChange({ kind: 'rgba', values: [r / 255, g / 255, b / 255, color.values[3]] });
    };
    const changeAlphaHandler = (a: number): void => {
        const [r, g, b] = color.values;
        onChange({ kind: 'rgba', values: [r, g, b, a / 100] });
    };

    return (
        <>
            <Box mt={2}>
                <RgbColorPicker
                    color={rgb}
                    onChange={changeHandler}
                />
            </Box>
            <VStack
                mt={2}
                spacing={0.5}
            >
                <RgbSliders
                    rgb={rgb}
                    onChange={changeHandler}
                />
                <RgbHexInput
                    rgb={rgb}
                    onChange={changeHandler}
                />
                <SliderAlpha
                    color={rgbToCssHex(rgb)}
                    value={alpha}
                    onChange={changeAlphaHandler}
                />
            </VStack>
        </>
    );
});

const toGrayscale = (color: ColorJson): GrayscaleColorJson => {
    if (color.kind === 'grayscale') return color;
    const [r, g, b] = color.values;
    return { kind: 'grayscale', values: [0.3 * r + 0.5 * g + 0.2 * b] };
};
const toRgb = (color: ColorJson): RgbColorJson => {
    if (color.kind === 'rgb') return color;
    if (color.kind === 'grayscale') {
        const [luma] = color.values;
        return { kind: 'rgb', values: [luma, luma, luma] };
    }
    const [r, g, b] = color.values;
    return { kind: 'rgb', values: [r, g, b] };
};
const toRgba = (color: ColorJson): RgbaColorJson => {
    if (color.kind === 'rgba') return color;
    if (color.kind === 'grayscale') {
        const [luma] = color.values;
        return { kind: 'rgba', values: [luma, luma, luma, 1] };
    }
    const [r, g, b] = color.values;
    return { kind: 'rgba', values: [r, g, b, 1] };
};
// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, react-memo/require-memo
function toKind<K extends ColorKind>(color: ColorJson, kind: K): OfKind<ColorJson, K> {
    if (kind === 'grayscale') return toGrayscale(color) as never;
    if (kind === 'rgb') return toRgb(color) as never;
    return toRgba(color) as never;
}

const KIND_ORDER: readonly ColorKind[] = ['grayscale', 'rgb', 'rgba'];
const KIND_LABEL: Readonly<Record<ColorKind, string>> = {
    grayscale: 'Gray',
    rgb: 'RGB',
    rgba: 'RGBA',
};

const MultiColorPicker = memo(
    ({
        color: outsideColor,
        onChange,
        kinds: kindSet,
        internalColor,
    }: ColorBoxProps & { internalColor: React.MutableRefObject<ColorJson> }) => {
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

        const kinds = useMemo(() => {
            return [...kindSet].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
        }, [kindSet]);

        return (
            <>
                {kinds.length >= 2 && (
                    <ButtonGroup
                        isAttached
                        mb={2}
                        size="sm"
                    >
                        {kinds.map((k) => {
                            return (
                                <Button
                                    borderRadius="lg"
                                    key={k}
                                    variant={color.kind === k ? 'solid' : 'ghost'}
                                    onClick={() => setColor(toKind(color, k))}
                                >
                                    {KIND_LABEL[k]}
                                </Button>
                            );
                        })}
                    </ButtonGroup>
                )}
                <ButtonGroup
                    isAttached
                    display="flex"
                    variant="unstyled"
                >
                    <Tooltip
                        closeOnClick
                        closeOnPointerDown
                        hasArrow
                        borderRadius={8}
                        label="Reset to old color"
                        openDelay={1000}
                    >
                        <Button
                            background={getCssBackground(outsideColor)}
                            borderRadius="lg"
                            color={getTextColorFor(outsideColor)}
                            h={12}
                            style={{ backgroundPositionX: '100%' }}
                            transitionProperty="none"
                            w="full"
                            onClick={() => setColor(outsideColor)}
                        >
                            old
                        </Button>
                    </Tooltip>
                    <Tooltip
                        closeOnClick
                        closeOnPointerDown
                        hasArrow
                        borderRadius={8}
                        label="Accept new color"
                        openDelay={1000}
                    >
                        <Button
                            background={getCssBackground(color)}
                            borderRadius="lg"
                            color={getTextColorFor(color)}
                            h={12}
                            transitionProperty="none"
                            w="full"
                            onClick={() => onChange(color)}
                        >
                            new
                        </Button>
                    </Tooltip>
                </ButtonGroup>
                {color.kind === 'grayscale' && (
                    <GrayPicker
                        color={color}
                        onChange={setColor}
                    />
                )}
                {color.kind === 'rgb' && (
                    <RgbPicker
                        color={color}
                        onChange={setColor}
                    />
                )}
                {color.kind === 'rgba' && (
                    <RgbaPicker
                        color={color}
                        onChange={setColor}
                    />
                )}
            </>
        );
    }
);

const ColorBox = memo(({ color, onChange, kinds }: ColorBoxProps) => {
    const internalColor = useRef(color);

    return (
        <Popover
            isLazy
            placement="right-start"
            onClose={() => onChange(internalColor.current)}
        >
            <PopoverTrigger>
                <Button
                    background={getCssBackground(color)}
                    backgroundClip="content-box"
                    border="1px solid"
                    borderColor="inherit"
                    borderRadius="lg"
                    boxSizing="border-box"
                    className="nodrag"
                    cursor="pointer"
                    h={6}
                    m={0}
                    p={0}
                    transitionProperty="none"
                    variant="unstyled"
                    w="6.5rem"
                >
                    <Text
                        color={getTextColorFor(color)}
                        cursor="pointer"
                        fontSize="sm"
                        fontWeight="medium"
                        textAlign="center"
                    >
                        {toDisplayText(color)}
                    </Text>
                </Button>
            </PopoverTrigger>
            <Portal>
                <PopoverContent className="chainner-color-selector">
                    <PopoverArrow />
                    <PopoverBody p={2}>
                        <MultiColorPicker
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
                            <ColorBox
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
