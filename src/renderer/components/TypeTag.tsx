import { Tag, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { isNumericLiteral } from '../../common/types/type-util';
import { Type } from '../../common/types/types';

const getTypeText = (type: Type): string | undefined => {
    if (isNumericLiteral(type)) return type.toString();

    if (type.type === 'struct') {
        if (type.name === 'Image' && type.fields.length === 3) {
            const [width, height /* , _channels */] = type.fields;
            if (isNumericLiteral(width.type) && isNumericLiteral(height.type)) {
                return `${width.type.toString()}x${height.type.toString()}`;
            }
        }
    }
    return undefined;
};

export interface TypeTagProps {
    type: Type;
}

export const TypeTag = memo(({ type }: TypeTagProps) => {
    const text = getTypeText(type);

    const tagColor = useColorModeValue('gray.400', 'gray.750');
    const tagFontColor = useColorModeValue('gray.700', 'gray.400');

    return (
        // eslint-disable-next-line react/jsx-no-useless-fragment
        <>
            {text && (
                <Tag
                    bgColor={tagColor}
                    color={tagFontColor}
                    fontSize="x-small"
                    height="15px"
                    lineHeight="auto"
                    minHeight="auto"
                    minWidth="auto"
                    ml={1}
                    px={1}
                    py={0}
                    size="sm"
                    variant="subtle"
                >
                    {text}
                </Tag>
            )}
        </>
    );
});
