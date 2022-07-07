import { Tag, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { Type } from '../../common/types/types';
import { isNumericLiteral } from '../../common/types/util';

const getColorMode = (channels: number) => {
    switch (channels) {
        case 1:
            return 'Gray';
        case 3:
            return 'RGB';
        case 4:
            return 'RGBA';
        default:
            return undefined;
    }
};

const getTypeText = (type: Type): string[] => {
    if (isNumericLiteral(type)) return [type.toString()];

    const tags: string[] = [];
    if (type.type === 'struct') {
        if (type.name === 'Image' && type.fields.length === 3) {
            const [width, height, channels] = type.fields;
            if (isNumericLiteral(width.type) && isNumericLiteral(height.type)) {
                tags.push(`${width.type.toString()}x${height.type.toString()}`);
            }
            if (isNumericLiteral(channels.type)) {
                const mode = getColorMode(channels.type.value);
                if (mode) {
                    tags.push(mode);
                }
            }
        }
    }
    return tags;
};

export interface TypeTagProps {
    type: Type;
}

export const TypeTag = memo(({ type }: TypeTagProps) => {
    const tags = getTypeText(type);

    const tagColor = useColorModeValue('gray.400', 'gray.750');
    const tagFontColor = useColorModeValue('gray.700', 'gray.400');

    return (
        <>
            {tags.map((text) => (
                <Tag
                    bgColor={tagColor}
                    color={tagFontColor}
                    fontSize="x-small"
                    height="15px"
                    key={text}
                    lineHeight="auto"
                    minHeight="15px"
                    minWidth={0}
                    ml={1}
                    px={1}
                    size="sm"
                    variant="subtle"
                >
                    {text}
                </Tag>
            ))}
        </>
    );
});
