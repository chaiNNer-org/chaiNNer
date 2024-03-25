import { HStack, Input, Spacer, Text } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { RgbColor } from 'react-colorful';
import { parseRgbHex, rgbToHex } from '../../../helpers/colorUtil';

interface RgbHexInputProps {
    rgb: RgbColor;
    onChange: (value: RgbColor) => void;
}
export const RgbHexInput = memo(({ rgb, onChange }: RgbHexInputProps) => {
    const currentHex = rgbToHex(rgb);

    const [inputString, setInputString] = useState(currentHex);
    useEffect(() => {
        setInputString((old) => {
            const parsed = parseRgbHex(old);
            if (parsed && rgbToHex(parsed) === currentHex) {
                return old;
            }
            return currentHex;
        });
    }, [currentHex]);

    const changeInputString = (s: string) => {
        setInputString(s);

        const parsed = parseRgbHex(s);
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
            />
        </HStack>
    );
});
