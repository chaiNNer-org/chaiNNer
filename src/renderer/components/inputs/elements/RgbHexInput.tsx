import { HStack, Input, Spacer, Text } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Color } from '../../../helpers/color';

interface RgbHexInputProps {
    rgb: Color;
    onChange: (value: Color) => void;
}
export const RgbHexInput = memo(({ rgb, onChange }: RgbHexInputProps) => {
    const { t } = useTranslation();
    const currentHex = rgb.hex();

    const [inputString, setInputString] = useState<string>(currentHex);
    useEffect(() => {
        setInputString((old) => {
            try {
                const parsed = Color.fromHex(old);
                if (parsed.hex() === currentHex) {
                    return old;
                }
            } catch {
                // ignore error
            }
            return currentHex;
        });
    }, [currentHex]);

    const changeInputString = (s: string) => {
        setInputString(s);

        try {
            const parsed = Color.fromHex(s);
            if (parsed.hex() !== currentHex) {
                onChange(parsed);
            }
        } catch {
            // ignore error
        }
    };

    return (
        <HStack w="full">
            <Text>{t('inputs.rgbHex.hex')}</Text>
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
