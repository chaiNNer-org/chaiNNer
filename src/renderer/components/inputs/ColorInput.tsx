/* eslint-disable prefer-arrow-functions/prefer-arrow-functions */
/* eslint-disable no-param-reassign */
/* eslint-disable react/jsx-props-no-spreading */
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
import { ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HsvColor, RgbColor, RgbaColor } from 'react-colorful';
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
import { hsvEqual, hsvToRgb, rgbEqual, rgbToHsv } from './elements/color-util';
import { HsvColorPicker } from './elements/ColorPicker';
import { LINEAR_SCALE, SliderStyle, StyledSlider } from './elements/StyledSlider';
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
    r = Math.round(r * 255);

    g = Math.round(g * 255);

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
            return `${to8Bit(r)} ${to8Bit(g)} ${to8Bit(b)} ${toPercent(a)}`;
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
    if (hex.startsWith('#')) {
        hex = hex.slice(1);
    }
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
    return `#${to8BitHex(r / 255, g / 255, b / 255)}`;
};

interface ColorSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    def: number;
    min: number;
    max: number;
    precision: number;
    style: SliderStyle;
}
const ColorSlider = memo(
    ({ label, value, onChange, def, min, max, precision, style }: ColorSliderProps) => {
        // const formatNumber = useCallback((n:number) => n.toFixed(precision),[precision])
        value = Number(value.toFixed(precision));

        const [inputString, setInputString] = useState(String(value));
        useEffect(() => {
            setInputString(String(value));
        }, [value]);

        const changeHandler = (n: number) => {
            if (min <= n && n <= max) {
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

type BaseProps = Omit<ColorSliderProps, 'label' | 'value' | 'onChange'>;
const get8BitProps = (color0: string, color255: string): BaseProps => ({
    def: 128,
    min: 0,
    max: 255,
    precision: 0,
    style: { type: 'gradient', gradient: [color0, color255] },
});
const getAlphaProps = (color?: string): BaseProps => ({
    def: 100,
    min: 0,
    max: 100,
    precision: 1,
    style: { type: 'alpha', color },
});
const getHueProps = (): BaseProps => ({
    def: 0,
    min: 0,
    max: 360,
    precision: 0,
    style: {
        type: 'gradient',
        gradient: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
    },
});
const getSaturationProps = (h: number, v: number): BaseProps => ({
    def: 0,
    min: 0,
    max: 100,
    precision: 0,
    style: {
        type: 'gradient',
        gradient: [rgbToHex(hsvToRgb({ h, s: 0, v })), rgbToHex(hsvToRgb({ h, s: 100, v }))],
    },
});
const getValueProps = (h: number, s: number): BaseProps => ({
    def: 50,
    min: 0,
    max: 100,
    precision: 0,
    style: {
        type: 'gradient',
        gradient: [rgbToHex(hsvToRgb({ h, s, v: 0 })), rgbToHex(hsvToRgb({ h, s, v: 100 }))],
    },
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
                w="4.5rem"
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
            <ColorSlider
                {...get8BitProps(rgbToHex({ ...rgb, r: 0 }), rgbToHex({ ...rgb, r: 255 }))}
                label="R"
                value={rgb.r}
                onChange={(r) => onChange({ ...rgb, r })}
            />
            <ColorSlider
                {...get8BitProps(rgbToHex({ ...rgb, g: 0 }), rgbToHex({ ...rgb, g: 255 }))}
                label="G"
                value={rgb.g}
                onChange={(g) => onChange({ ...rgb, g })}
            />
            <ColorSlider
                {...get8BitProps(rgbToHex({ ...rgb, b: 0 }), rgbToHex({ ...rgb, b: 255 }))}
                label="B"
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
const HsvSliders = memo(({ hsv, onChange }: HsvSlidersProps) => {
    return (
        <>
            <ColorSlider
                {...getHueProps()}
                label="H"
                value={hsv.h}
                onChange={(h) => onChange({ ...hsv, h })}
            />
            <ColorSlider
                {...getSaturationProps(hsv.h, hsv.v)}
                label="S"
                value={hsv.s}
                onChange={(s) => onChange({ ...hsv, s })}
            />
            <ColorSlider
                {...getValueProps(hsv.h, hsv.s)}
                label="V"
                value={hsv.v}
                onChange={(v) => onChange({ ...hsv, v })}
            />
        </>
    );
});

const updateRgbX = (o: RgbColor, n: RgbColor): RgbColor => {
    return rgbEqual(o, n) ? o : n;
};
const updateHsvX = (o: HsvColor, n: HsvColor): HsvColor => {
    return hsvEqual(o, n) ? o : n;
};
const updateHsvFromRgbX = (oldHsv: HsvColor, newRgb: RgbColor): HsvColor => {
    const oldRgb = hsvToRgb(oldHsv);
    if (!rgbEqual(newRgb, oldRgb)) {
        const newHsv = rgbToHsv(newRgb);

        // check to see whether we actually need to change H and S
        if (rgbEqual(newRgb, hsvToRgb({ ...newHsv, h: oldHsv.h }))) {
            newHsv.h = oldHsv.h;
        }
        if (rgbEqual(newRgb, hsvToRgb({ ...newHsv, s: oldHsv.s }))) {
            newHsv.s = oldHsv.s;
        }

        if (!hsvEqual(newHsv, oldHsv)) {
            return newHsv;
        }
    }
    return oldHsv;
};

interface UseColorMode {
    rgb: RgbColor;
    hsv: HsvColor;
    changeRgb: (value: RgbColor) => void;
    changeHsv: (value: HsvColor) => void;
}
const useColorModes = (color: ColorJson, onChange: (value: RgbColor) => void): UseColorMode => {
    const [state, setState] = useState<readonly [RgbColor, HsvColor]>(() => {
        const rgb = toRgbColor(color);
        return [rgb, rgbToHsv(rgb)];
    });
    const lastChangeRef = useRef(0);

    const updateFromRgb = useCallback((newRgb: RgbColor): void => {
        setState((old) => {
            const [oldRgb, oldHsv] = old;

            if (!rgbEqual(oldRgb, newRgb)) {
                return [newRgb, updateHsvFromRgbX(oldHsv, newRgb)];
            }
            return old;
        });
    }, []);
    const updateFromHsv = useCallback((newHsv: HsvColor, newRgb: RgbColor): void => {
        setState((old) => {
            const [oldRgb, oldHsv] = old;

            newRgb = updateRgbX(oldRgb, newRgb);
            newHsv = updateHsvX(oldHsv, newHsv);
            if (newHsv !== oldHsv || newRgb !== oldRgb) {
                return [newRgb, newHsv];
            }
            return old;
        });
    }, []);

    useEffect(() => {
        const sinceLastChange = Date.now() - lastChangeRef.current;
        if (sinceLastChange > 200) {
            updateFromRgb(toRgbColor(color));
        }
    }, [color, updateFromRgb]);

    const changeRgb = useCallback(
        (newRgb: RgbColor): void => {
            lastChangeRef.current = Date.now();
            updateFromRgb(newRgb);
            onChange(newRgb);
        },
        [onChange, updateFromRgb]
    );
    const changeHsv = useCallback(
        (newHsv: HsvColor): void => {
            lastChangeRef.current = Date.now();
            const newRgb = hsvToRgb(newHsv);
            updateFromHsv(newHsv, newRgb);
            onChange(newRgb);
        },
        [onChange, updateFromHsv]
    );

    const [rgb, hsv] = state;
    return { rgb, hsv, changeRgb, changeHsv };
};

const KIND_SELECTOR_HEIGHT = '2rem';
const COMPARE_BUTTON_HEIGHT = '3rem';

interface RgbOrRgbaPickerProps extends Omit<PickerFor<ColorJson>, 'onChange'> {
    onChange: (color: RgbColor) => void;
    alpha?: ReactNode;
}
const RgbOrRgbaPicker = memo(
    ({ color, onChange, alpha, compare, kindSelector }: RgbOrRgbaPickerProps) => {
        const { rgb, hsv, changeRgb, changeHsv } = useColorModes(color, onChange);

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
                        {...get8BitProps('black', 'white')}
                        label="L"
                        value={value}
                        onChange={changeHandler}
                    />
                </HStack>
            </HStack>
        );
    }
);
const RgbPicker = memo(({ color, onChange, compare, kindSelector }: PickerFor<RgbColorJson>) => {
    const onChangeRgb = useCallback(
        ({ r, g, b }: RgbColor): void => {
            onChange({ kind: 'rgb', values: [r / 255, g / 255, b / 255] });
        },
        [onChange]
    );

    return (
        <RgbOrRgbaPicker
            color={color}
            compare={compare}
            kindSelector={kindSelector}
            onChange={onChangeRgb}
        />
    );
});
const RgbaPicker = memo(({ color, onChange, compare, kindSelector }: PickerFor<RgbaColorJson>) => {
    const originalAlpha = color.values[3];
    const alpha = Number((originalAlpha * 100).toFixed(1));
    const changeAlphaHandler = (a: number): void => {
        const [r, g, b] = color.values;
        onChange({ kind: 'rgba', values: [r, g, b, a / 100] });
    };

    const onChangeRgb = useCallback(
        ({ r, g, b }: RgbColor): void => {
            onChange({ kind: 'rgba', values: [r / 255, g / 255, b / 255, originalAlpha] });
        },
        [onChange, originalAlpha]
    );

    return (
        <RgbOrRgbaPicker
            alpha={
                <ColorSlider
                    {...getAlphaProps(rgbToHex(toRgbColor(color)))}
                    label="A"
                    value={alpha}
                    onChange={changeAlphaHandler}
                />
            }
            color={color}
            compare={compare}
            kindSelector={kindSelector}
            onChange={onChangeRgb}
        />
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
// eslint-disable-next-line react-memo/require-memo
function toKind<K extends ColorKind>(color: ColorJson, kind: K): OfKind<ColorJson, K> {
    if (kind === 'grayscale') return toGrayscale(color) as never;
    if (kind === 'rgb') return toRgb(color) as never;
    return toRgba(color) as never;
}

interface CompareButtonsProps {
    oldColor: ColorJson;
    newColor: ColorJson;
    onOldClick: () => void;
    onNewClick: () => void;
}
const CompareButtons = memo(
    ({ oldColor, newColor, onOldClick, onNewClick }: CompareButtonsProps) => {
        return (
            <ButtonGroup
                isAttached
                display="flex"
                variant="unstyled"
                w="full"
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
                        background={getCssBackground(oldColor)}
                        borderRadius="lg"
                        color={getTextColorFor(oldColor)}
                        h={COMPARE_BUTTON_HEIGHT}
                        style={{ backgroundPositionX: '100%' }}
                        transitionProperty="none"
                        w="full"
                        onClick={onOldClick}
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
                        background={getCssBackground(newColor)}
                        borderRadius="lg"
                        color={getTextColorFor(newColor)}
                        h={COMPARE_BUTTON_HEIGHT}
                        transitionProperty="none"
                        w="full"
                        onClick={onNewClick}
                    >
                        new
                    </Button>
                </Tooltip>
            </ButtonGroup>
        );
    }
);

const KIND_ORDER: readonly ColorKind[] = ['grayscale', 'rgb', 'rgba'];
const KIND_LABEL: Readonly<Record<ColorKind, string>> = {
    grayscale: 'Gray',
    rgb: 'RGB',
    rgba: 'RGBA',
};

interface ColorKindSelectorProps {
    kinds: ReadonlySet<ColorKind>;
    current: ColorKind;
    onSelect: (kind: ColorKind) => void;
}
const ColorKindSelector = memo(({ kinds, current, onSelect }: ColorKindSelectorProps) => {
    const kindArray = useMemo(() => {
        return [...kinds].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
    }, [kinds]);

    return (
        <ButtonGroup
            isAttached
            size="sm"
            w="full"
        >
            {kindArray.map((k) => {
                return (
                    <Button
                        borderRadius="lg"
                        key={k}
                        variant={current === k ? 'solid' : 'ghost'}
                        w="full"
                        onClick={() => onSelect(k)}
                    >
                        {KIND_LABEL[k]}
                    </Button>
                );
            })}
        </ButtonGroup>
    );
});

const MultiColorPicker = memo(
    ({
        color: outsideColor,
        onChange,
        kinds,
        internalColor,
    }: ColorBoxProps & { internalColor: React.MutableRefObject<ColorJson> }) => {
        // eslint-disable-next-line react/hook-use-state
        const [color, setColorInternal] = useState(outsideColor);
        const setColor = useCallback(
            (value: ColorJson): void => {
                setColorInternal(value);

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
            <CompareButtons
                newColor={color}
                oldColor={outsideColor}
                onNewClick={() => onChange(color)}
                onOldClick={() => setColor(outsideColor)}
            />
        );

        const Component = { grayscale: GrayPicker, rgb: RgbPicker, rgba: RgbaPicker }[color.kind];
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

const ColorBox = memo(({ color, onChange, kinds }: ColorBoxProps) => {
    const internalColor = useRef(color);

    return (
        <Popover
            isLazy
            placement="bottom-start"
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
                    w="8rem"
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
                <PopoverContent
                    className="chainner-color-selector"
                    w="auto"
                >
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
