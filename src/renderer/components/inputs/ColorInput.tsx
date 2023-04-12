import { Box, Center, Spacer, Text } from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { ColorJson } from '../../../common/common-types';
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
const ColorBox = memo(({ color, onChange, kinds }: ColorBoxProps) => {
    const cssColor = toCssColor(color);
    return (
        <Box
            background={
                color.kind === 'rgba' && color.values[3] < 1
                    ? `linear-gradient(${cssColor},${cssColor}), repeating-conic-gradient(#CDCDCD 0% 25%, #FFFFFF 0% 50%)`
                    : cssColor
            }
            // bgColor={toCssColor(color)}
            backgroundClip="content-box"
            backgroundSize="20px 20px"
            border="1px solid"
            borderColor="inherit"
            borderRadius="lg"
            boxSizing="border-box"
            className="nodrag"
            cursor="pointer"
            h={6}
            w={9}
            onClick={() =>
                onChange({
                    kind: 'rgba',
                    values: [Math.random(), Math.random(), Math.random(), Math.random() / 2 + 0.5],
                })
            }
        />
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
