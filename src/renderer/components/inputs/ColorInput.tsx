import {
    Box,
    Button,
    ButtonGroup,
    Center,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverContent,
    PopoverTrigger,
    Portal,
    Spacer,
    Text,
    Tooltip,
} from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RgbColorPicker, RgbaColor, RgbaColorPicker } from 'react-colorful';
import { rgb as rgbContrast } from 'wcag-contrast';
import {
    ColorJson,
    GrayscaleColorJson,
    OfKind,
    RgbColorJson,
    RgbaColorJson,
} from '../../../common/common-types';
import { assertNever } from '../../../common/util';
import { TypeTags } from '../TypeTag';
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
const toLabelText = (color: ColorJson): string => {
    if (color.kind === 'rgba') {
        const [r, g, b, a] = color.values;
        return `${to8Bit(r)} ${to8Bit(g)} ${to8Bit(b)} ${toPercent(a)}`;
    }
    return toDisplayText(color);
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

const typeLabels: Record<ColorKind, string> = {
    grayscale: 'grayscale',
    rgb: 'RGB',
    rgba: 'RGBA',
};
const getColorTooltip = (color: ColorJson): JSX.Element => {
    return (
        <>
            Click to edit {typeLabels[color.kind]} color <strong>{toLabelText(color)}</strong>.
        </>
    );
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

export interface PickerProps<T> {
    color: T;
    onChange: (value: T) => void;
}
const RgbaPicker = memo(({ color, onChange }: PickerProps<RgbaColorJson>) => {
    return (
        <RgbaColorPicker
            color={toRgbaColor(color)}
            onChange={({ r, g, b, a }) => {
                onChange({ kind: 'rgba', values: [r / 255, g / 255, b / 255, a] });
            }}
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

const ColorBox = memo(({ color: outsideColor, onChange, kinds: kindSet }: ColorBoxProps) => {
    const [color, setColor] = useState(outsideColor);
    useEffect(() => setColor(outsideColor), [outsideColor]);

    const kinds = useMemo(() => {
        return [...kindSet].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));
    }, [kindSet]);

    return (
        <Popover
            isLazy
            onClose={() => onChange(color)}
        >
            {({ onClose }) => (
                <>
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
                            {/* <PopoverCloseButton /> */}
                            <PopoverBody p={2}>
                                <ButtonGroup
                                    isAttached
                                    size="sm"
                                >
                                    {kinds.map((k) => {
                                        return (
                                            <Button
                                                borderRadius="lg"
                                                key={k}
                                                variant={color.kind === k ? 'solid' : 'ghost'}
                                                onClick={() => setColor((c) => toKind(c, k))}
                                            >
                                                {KIND_LABEL[k]}
                                            </Button>
                                        );
                                    })}
                                </ButtonGroup>
                                <ButtonGroup
                                    isAttached
                                    display="flex"
                                    my={2}
                                    variant="unstyled"
                                >
                                    <Tooltip
                                        closeOnClick
                                        closeOnPointerDown
                                        hasArrow
                                        borderRadius={8}
                                        label="Reset to old color"
                                        openDelay={500}
                                    >
                                        <Button
                                            background={getCssBackground(outsideColor)}
                                            borderRadius="lg"
                                            color={getTextColorFor(outsideColor)}
                                            h={12}
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
                                        openDelay={500}
                                    >
                                        <Button
                                            background={getCssBackground(color)}
                                            borderRadius="lg"
                                            color={getTextColorFor(color)}
                                            h={12}
                                            transitionProperty="none"
                                            w="full"
                                            onClick={onClose}
                                        >
                                            new
                                        </Button>
                                    </Tooltip>
                                </ButtonGroup>
                                {color.kind === 'rgba' && (
                                    <RgbaColorPicker
                                        color={toRgbaColor(color)}
                                        onChange={({ r, g, b, a }) => {
                                            setColor({
                                                kind: 'rgba',
                                                values: [r / 255, g / 255, b / 255, a],
                                            });
                                        }}
                                    />
                                )}
                                {color.kind === 'rgb' && (
                                    <RgbColorPicker
                                        color={toRgbaColor(color)}
                                        onChange={({ r, g, b }) => {
                                            setColor({
                                                kind: 'rgb',
                                                values: [r / 255, g / 255, b / 255],
                                            });
                                        }}
                                    />
                                )}
                            </PopoverBody>
                        </PopoverContent>
                    </Portal>
                </>
            )}
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
