import { StructType, Type, without } from '@chainner/navi';
import { Tag } from '@chakra-ui/react';
import React, { memo } from 'react';
import { isImage, isNumericLiteral } from '../../common/types/util';

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

const nullType = new StructType('null');

const getTypeText = (type: Type): string[] => {
    if (isNumericLiteral(type)) return [type.toString()];

    const tags: string[] = [];
    if (type.type === 'struct') {
        if (isImage(type)) {
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

        if (type.name === 'PyTorchModel' && type.fields.length === 3) {
            const [scale] = type.fields;
            if (isNumericLiteral(scale.type)) {
                tags.push(`${scale.type.toString()}x`);
            }
        }
    }
    return tags;
};

export interface TypeTagProps {
    isOptional?: boolean;
}

export const TypeTag = memo(({ children, isOptional }: React.PropsWithChildren<TypeTagProps>) => {
    return (
        <Tag
            bgColor="var(--tag-bg)"
            color="var(--tag-fg)"
            fontSize="x-small"
            fontStyle={isOptional ? 'italic' : undefined}
            height="15px"
            lineHeight="auto"
            minHeight="15px"
            minWidth={0}
            ml={1}
            px={1}
            size="sm"
            variant="subtle"
        >
            {children}
        </Tag>
    );
});

export interface TypeTagsProps {
    type: Type;
    isOptional: boolean;
}

export const TypeTags = memo(({ type, isOptional }: TypeTagsProps) => {
    const tags = getTypeText(without(type, nullType));

    return (
        <>
            {tags.map((text) => (
                <TypeTag key={text}>{text}</TypeTag>
            ))}
            {isOptional && <TypeTag isOptional>optional</TypeTag>}
        </>
    );
});
