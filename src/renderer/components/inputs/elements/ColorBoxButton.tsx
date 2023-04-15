import { Button, Text, forwardRef } from '@chakra-ui/react';
import { getCssBackground, getTextColor } from '../../../../common/color-json-util';
import { ColorJson } from '../../../../common/common-types';
import { assertNever } from '../../../../common/util';

const to8Bit = (n: number): string => String(Math.round(n * 255));
const toPercent = (n: number): string => `${String(Math.round(n * 100))}%`;

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

interface ColorBoxButtonProps {
    color: ColorJson;
}
export const ColorBoxButton = forwardRef<ColorBoxButtonProps, 'button'>(
    // eslint-disable-next-line react-memo/require-memo
    ({ color, ...props }, ref) => {
        return (
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
                ref={ref}
                transitionProperty="none"
                variant="unstyled"
                w="8rem"
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...props}
            >
                <Text
                    color={getTextColor(color)}
                    cursor="pointer"
                    fontSize="sm"
                    fontWeight="medium"
                    textAlign="center"
                >
                    {toDisplayText(color)}
                </Text>
            </Button>
        );
    }
);
