import { Box, Center, Spacer, Text, Tooltip } from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { ColorJson, RgbColorJson, RgbaColorJson } from '../../../common/common-types';
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
const isLightColor = (color: ColorJson): boolean => {
    const LIGHTNESS_THRESHOLD = 0.2;
    if (color.kind === 'grayscale') {
        return color.values[0] ** 2.2 >= LIGHTNESS_THRESHOLD;
    }

    let [r, g, b] = color.values;
    if (color.kind === 'rgba') {
        [r, g, b] = withBg(color, { kind: 'rgb', values: [0.9, 0.9, 0.9] }).values;
    }

    r **= 2.2;
    g **= 2.2;
    b **= 2.2;

    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return l >= LIGHTNESS_THRESHOLD;
};
const BG1: RgbColorJson = { kind: 'rgb', values: [0.8, 0.8, 0.8] };
const BG2: RgbColorJson = { kind: 'rgb', values: [1, 1, 1] };
const getCssBackground = (color: ColorJson): string => {
    if (color.kind === 'rgba' && color.values[3] < 1) {
        return `repeating-conic-gradient(${toCssColor(withBg(color, BG1))} 0% 25%, ${toCssColor(
            withBg(color, BG2)
        )} 0% 50%) 0 0 / 20px 20px`;
    }
    return toCssColor(color);
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

const ColorBox = memo(({ color, onChange, kinds }: ColorBoxProps) => {
    return (
        <Tooltip
            closeOnClick
            closeOnPointerDown
            hasArrow
            borderRadius={8}
            label={getColorTooltip(color)}
            openDelay={500}
        >
            <Box
                background={getCssBackground(color)}
                backgroundClip="content-box"
                border="1px solid"
                borderColor="inherit"
                borderRadius="lg"
                boxSizing="border-box"
                className="nodrag"
                cursor="pointer"
                h={6}
                w="6.5rem"
                onClick={() =>
                    onChange({
                        kind: 'rgba',
                        values: [
                            Math.random(),
                            Math.random(),
                            Math.random(),
                            Math.min(1, Math.random() + 0.25),
                        ],
                    })
                }
            >
                <Text
                    color={isLightColor(color) ? 'black' : 'white'}
                    // fontFamily="monospace"
                    cursor="pointer"
                    fontSize="sm"
                    fontWeight="medium"
                    textAlign="center"
                >
                    {toDisplayText(color)}
                </Text>
            </Box>
        </Tooltip>
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

        useEffect(() => {
            if (value === undefined) {
                setValue(def);
            }
        }, [value, setValue, def]);

        const current = value ?? def;
        const color = useMemo(() => {
            try {
                return JSON.parse(current) as ColorJson;
            } catch (error) {
                log.error(error);
                return undefined;
            }
        }, [current]);

        useEffect(() => {
            if (!color) {
                // reset invalid colors
                setValue(def);
            }
        }, [color, setValue, def]);

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
