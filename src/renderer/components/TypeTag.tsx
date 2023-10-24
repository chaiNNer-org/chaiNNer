import {
    Bounds,
    IntIntervalType,
    IntervalType,
    NeverType,
    Type,
    intInterval,
    isNumericLiteral,
    isStringLiteral,
    isStructInstance,
    isSubsetOf,
    literal,
} from '@chainner/navi';
import { Tag, Tooltip, forwardRef } from '@chakra-ui/react';
import React, { ReactNode, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { explain } from '../../common/types/explain';
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

const getSimplifiedNumberRange = (type: Type): IntIntervalType | IntervalType | undefined => {
    if (type.underlying === 'number') {
        if (type.type === 'interval' || type.type === 'int-interval') {
            return type;
        }
        if (type.type === 'non-int-interval') {
            if (Number.isFinite(type.min) && Number.isFinite(type.max)) {
                return new IntervalType(type.min, type.max, Bounds.Inclusive);
            }
            return new IntervalType(type.min, type.max, Bounds.Exclusive);
        }
    }
    if (type.underlying === 'union') {
        let min = Infinity;
        let max = -Infinity;

        for (const item of type.items) {
            if (item.underlying === 'number') {
                if (item.type === 'literal') {
                    const { value } = item;
                    if (Number.isNaN(value)) {
                        // we don't deal with nan
                        return undefined;
                    }
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                } else if (item.type === 'number') {
                    // we don't deal with all numbers
                    return undefined;
                } else {
                    min = Math.min(min, item.min);
                    max = Math.max(max, item.max);
                }
            } else {
                return undefined;
            }
        }

        if (min < max) {
            if (isSubsetOf(type, intInterval(-Infinity, Infinity))) {
                return new IntIntervalType(min, max);
            }
            return new IntervalType(min, max, Bounds.Inclusive);
        }
    }
};

const collectNumericLiterals = (type: Type, maximum = 4): number[] | undefined => {
    const set = new Set<number>();

    const items = type.underlying === 'union' ? type.items : [type];
    for (const item of items) {
        if (item.underlying === 'number') {
            if (item.type === 'literal') {
                set.add(item.value);
                if (set.size > maximum) {
                    return undefined;
                }
            } else if (item.type === 'int-interval') {
                const count = item.max - item.min + 1;
                if (count + set.size > maximum) {
                    return undefined;
                }
                for (let i = item.min; i <= item.max; i += 1) {
                    set.add(i);
                }
            } else {
                return undefined;
            }
        } else {
            return undefined;
        }
    }

    const list = [...set];
    list.sort((a, b) => a - b);
    return list;
};

type TagValue =
    | { kind: 'literal'; value: string; tooltip?: string }
    | { kind: 'string'; value: string }
    | { kind: 'path'; value: string };

const getTypeText = (type: Type): TagValue[] => {
    if (isNumericLiteral(type)) return [{ kind: 'literal', value: type.toString() }];
    if (isStringLiteral(type)) return [{ kind: 'string', value: type.value }];

    const numberLiterals = collectNumericLiterals(type, 4);
    if (numberLiterals) {
        return [
            {
                kind: 'literal',
                value: numberLiterals.map((l) => literal(l).toString()).join(' | '),
            },
        ];
    }

    const rangeType = getSimplifiedNumberRange(type);
    if (rangeType) {
        const tooltip = explain(rangeType, { detailed: true });
        if (rangeType.type === 'interval') {
            const { min, max } = rangeType;
            if (Number.isFinite(min) && Number.isFinite(max)) {
                return [{ kind: 'literal', value: `${min} ~ ${max}`, tooltip }];
            }
            if (Number.isFinite(min) && max === Infinity) {
                const op = rangeType.minExclusive ? '>' : '>=';
                return [{ kind: 'literal', value: `${op} ${min}`, tooltip }];
            }
            if (min === -Infinity && Number.isFinite(max)) {
                const op = rangeType.maxExclusive ? '<' : '<=';
                return [{ kind: 'literal', value: `${op} ${max}`, tooltip }];
            }
        }
        if (rangeType.type === 'int-interval') {
            const { min, max } = rangeType;
            if (Number.isFinite(min) && Number.isFinite(max)) {
                return [{ kind: 'literal', value: `int ${min} ~ ${max}`, tooltip }];
            }
            if (Number.isFinite(min) && max === Infinity) {
                return [{ kind: 'literal', value: `int >= ${min}`, tooltip }];
            }
            if (min === -Infinity && Number.isFinite(max)) {
                return [{ kind: 'literal', value: `int <= ${max}`, tooltip }];
            }
        }
    }

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

    let tt: string | undefined;
    let text: NonNullable<ReactNode>;

    switch (kind) {
        case 'path': {
            tt = value;
            const maxLength = 14;
            text = (
                <>
                    {value.length > maxLength && <Punctuation>…</Punctuation>}
                    {value.slice(Math.max(0, value.length - maxLength))}
                </>
            );
            break;
        }
        case 'string': {
            tt = value;
            const maxLength = 16;
            text = (
                <>
                    {value.slice(0, maxLength)}
                    {value.length > maxLength && <Punctuation>…</Punctuation>}
                </>
            );
            break;
        }
        case 'literal': {
            tt = tag.tooltip;
            text = value;
            break;
        }
        default:
            return assertNever(kind);
    }

    if (!tt) {
        return <TypeTag>{text}</TypeTag>;
    }

    return (
        <Tooltip
            hasArrow
            borderRadius={8}
            label={tt}
            openDelay={500}
            px={2}
            textAlign="center"
        >
            <TypeTag>{text}</TypeTag>
        </Tooltip>
    );
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
