import {
    NeverType,
    Type,
    isNumericLiteral,
    isStringLiteral,
    isStructInstance,
} from '@chainner/navi';
import { Tag, Tooltip, forwardRef } from '@chakra-ui/react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFields, isColor, isDirectory, isImage, withoutNull } from '../../common/types/util';
import { assertNever } from '../../common/util';

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

type TagValue =
    | { kind: 'literal'; value: string }
    | { kind: 'string'; value: string }
    | { kind: 'path'; value: string };

const getTypeText = (type: Type): TagValue[] => {
    if (isNumericLiteral(type)) return [{ kind: 'literal', value: type.toString() }];
    if (isStringLiteral(type)) return [{ kind: 'string', value: type.value }];

    const tags: TagValue[] = [];
    if (isImage(type)) {
        const { width, height, channels } = getFields(type);
        if (isNumericLiteral(width) && isNumericLiteral(height)) {
            tags.push({
                kind: 'literal',
                value: `${width.toString()}x${height.toString()}`,
            });
        }
        if (isNumericLiteral(channels)) {
            const mode = getColorMode(channels.value);
            if (mode) {
                tags.push({ kind: 'literal', value: mode });
            }
        }
    }

    if (isColor(type)) {
        const { channels } = getFields(type);
        if (isNumericLiteral(channels)) {
            const mode = getColorMode(channels.value);
            if (mode) {
                tags.push({ kind: 'literal', value: mode });
            }
        }
    }

    if (isDirectory(type)) {
        const { path } = getFields(type);
        if (isStringLiteral(path)) {
            tags.push({ kind: 'path', value: path.value });
        }
    }

    if (isStructInstance(type)) {
        if (
            type.descriptor.name === 'PyTorchModel' ||
            type.descriptor.name === 'NcnnNetwork' ||
            type.descriptor.name === 'OnnxModel'
        ) {
            const scale = type.getField('scale') ?? NeverType.instance;
            if (isNumericLiteral(scale)) {
                tags.push({ kind: 'literal', value: `${scale.toString()}x` });
            }
            const subType = type.getField('subType') ?? NeverType.instance;
            if (isStringLiteral(subType)) {
                tags.push({ kind: 'literal', value: subType.value });
            }
        }
    }

    if (type.type === 'union') {
        if (type.items.length === 2) {
            const [color, image] = type.items;
            if (isColor(color) && isImage(image)) {
                const colorChannels = getFields(color).channels;
                const imageChannels = getFields(image).channels;
                if (
                    isNumericLiteral(colorChannels) &&
                    isNumericLiteral(imageChannels) &&
                    colorChannels.value === imageChannels.value
                ) {
                    const mode = getColorMode(colorChannels.value);
                    if (mode) {
                        tags.push({ kind: 'literal', value: mode });
                    }
                }
            }
        }
    }
    return tags;
};

export interface TypeTagProps {
    isOptional?: boolean;
}

export const TypeTag = memo(
    forwardRef<TypeTagProps, 'span'>((props, ref) => {
        const { isOptional, ...rest } = props;
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
                ref={ref}
                size="sm"
                variant="subtle"
                whiteSpace="pre"
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...rest}
            />
        );
    })
);

export interface TypeTagsProps {
    type: Type;
    isOptional: boolean;
}

const Punctuation = memo(({ children }: React.PropsWithChildren<unknown>) => {
    return <span style={{ opacity: '50%' }}>{children}</span>;
});

const TagRenderer = memo(({ tag }: { tag: TagValue }) => {
    const { kind, value } = tag;

    switch (kind) {
        case 'path': {
            const maxLength = 14;
            return (
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    label={value}
                    openDelay={500}
                    px={2}
                    textAlign="center"
                >
                    <TypeTag>
                        {value.length > maxLength && <Punctuation>…</Punctuation>}
                        {value.slice(Math.max(0, value.length - maxLength))}
                    </TypeTag>
                </Tooltip>
            );
        }
        case 'string': {
            const maxLength = 16;
            return (
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    label={value}
                    openDelay={500}
                    px={2}
                    textAlign="center"
                >
                    <TypeTag>
                        {value.slice(0, maxLength)}
                        {value.length > maxLength && <Punctuation>…</Punctuation>}
                    </TypeTag>
                </Tooltip>
            );
        }
        case 'literal': {
            return <TypeTag>{value}</TypeTag>;
        }
        default:
            return assertNever(kind);
    }
});

export const TypeTags = memo(({ type, isOptional }: TypeTagsProps) => {
    const { t } = useTranslation();
    const tags = getTypeText(withoutNull(type));

    return (
        <>
            {tags.map((tag) => (
                <TagRenderer
                    key={`${tag.kind};${tag.value}`}
                    tag={tag}
                />
            ))}
            {isOptional && <TypeTag isOptional>{t('typeTags.optional', 'optional')}</TypeTag>}
        </>
    );
});
