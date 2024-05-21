import { CloseIcon, SearchIcon, StarIcon } from '@chakra-ui/icons';
import {
    Box,
    Center,
    HStack,
    Icon,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    MenuList,
    Text,
} from '@chakra-ui/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VscLightbulbAutofix } from 'react-icons/vsc';
import { CategoryMap } from '../../common/CategoryMap';
import { Category, CategoryId, NodeSchema, SchemaId } from '../../common/common-types';
import { assertNever, groupBy, stopPropagation } from '../../common/util';
import { getCategoryAccentColor } from '../helpers/accentColors';
import { interpolateColor } from '../helpers/colorTools';
import { getMatchingNodes } from '../helpers/nodeSearchFuncs';
import { useThemeColor } from '../hooks/useThemeColor';
import { IconFactory } from './CustomIcons';
import { IfVisible } from './IfVisible';

const clampWithWrap = (min: number, max: number, value: number): number => {
    if (value < min) {
        return max;
    }
    if (value > max) {
        return min;
    }
    return value;
};

interface SchemaItemProps {
    schema: NodeSchema;
    isFavorite: boolean;
    accentColor: string;
    onClick: (schema: NodeSchema) => void;
    isSelected: boolean;
    scrollRef?: React.RefObject<HTMLDivElement>;
}
const SchemaItem = memo(
    ({ schema, onClick, isFavorite, accentColor, isSelected, scrollRef }: SchemaItemProps) => {
        const bgColor = useThemeColor('--bg-700');
        const menuBgColor = useThemeColor('--bg-800');

        const gradL = interpolateColor(accentColor, menuBgColor, 0.95);
        const gradR = menuBgColor;
        const hoverGradL = interpolateColor(accentColor, bgColor, 0.95);
        const hoverGradR = bgColor;

        return (
            <HStack
                _hover={{
                    bgGradient: `linear(to-r, ${hoverGradL}, ${hoverGradR})`,
                }}
                bgGradient={
                    isSelected
                        ? `linear(to-r, ${hoverGradL}, ${hoverGradR})`
                        : `linear(to-r, ${gradL}, ${gradR})`
                }
                borderRadius="md"
                key={schema.schemaId}
                mx={1}
                my={0.5}
                outline={isSelected ? '1px solid' : undefined}
                px={2}
                py={0.5}
                ref={scrollRef}
                onClick={() => onClick(schema)}
            >
                <IconFactory
                    accentColor="gray.500"
                    icon={schema.icon}
                />
                <Text
                    flex={1}
                    h="full"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    verticalAlign="middle"
                    whiteSpace="nowrap"
                >
                    {schema.name}
                </Text>
                {isFavorite && (
                    <StarIcon
                        aria-label="Favorites"
                        boxSize={2.5}
                        color="gray.500"
                        overflow="hidden"
                        stroke="gray.500"
                        verticalAlign="middle"
                    />
                )}
            </HStack>
        );
    }
);

type SchemaGroup = FavoritesSchemaGroup | SuggestedSchemaGroup | CategorySchemaGroup;
interface SchemaGroupBase {
    readonly name: string;
    readonly schemata: readonly NodeSchema[];
}
interface FavoritesSchemaGroup extends SchemaGroupBase {
    type: 'favorites';
    categoryId?: never;
}

interface SuggestedSchemaGroup extends SchemaGroupBase {
    type: 'suggested';
    categoryId?: never;
}
interface CategorySchemaGroup extends SchemaGroupBase {
    type: 'category';
    categoryId: CategoryId;
    category: Category | undefined;
}

const groupSchemata = (
    schemata: readonly NodeSchema[],
    categories: CategoryMap,
    favorites: ReadonlySet<SchemaId>,
    suggested: ReadonlySet<SchemaId>
): readonly SchemaGroup[] => {
    const cats = [...groupBy(schemata, 'category')].map(
        ([categoryId, categorySchemata]): CategorySchemaGroup => {
            const category = categories.get(categoryId);
            return {
                type: 'category',
                name: category?.name ?? categoryId,
                categoryId,
                category,
                schemata: categorySchemata,
            };
        }
    );

    const favs: FavoritesSchemaGroup = {
        type: 'favorites',
        name: 'Favorites',
        schemata: cats.flatMap((c) => c.schemata).filter((n) => favorites.has(n.schemaId)),
    };

    const suggs: SuggestedSchemaGroup = {
        type: 'suggested',
        name: 'Suggested',
        schemata: schemata.filter((n) => suggested.has(n.schemaId)),
    };

    return [
        ...(suggs.schemata.length ? [suggs] : []),
        ...(favs.schemata.length ? [favs] : []),
        ...cats,
    ];
};

const renderGroupIcon = (categories: CategoryMap, group: SchemaGroup) => {
    switch (group.type) {
        case 'favorites':
            return (
                <StarIcon
                    boxSize={3}
                    color="yellow.500"
                />
            );
        case 'suggested':
            return (
                <Icon
                    as={VscLightbulbAutofix}
                    boxSize={3}
                    color="cyan.500"
                />
            );
        case 'category':
            return (
                <IconFactory
                    accentColor={getCategoryAccentColor(categories, group.categoryId)}
                    boxSize={3}
                    icon={group.category?.icon}
                />
            );
        default:
            return assertNever(group);
    }
};

interface MenuProps {
    onSelect: (schema: NodeSchema) => void;
    schemata: readonly NodeSchema[];
    favorites: ReadonlySet<SchemaId>;
    categories: CategoryMap;
    suggestions: ReadonlySet<SchemaId>;
}

export const Menu = memo(
    ({ onSelect, schemata, favorites, categories, suggestions }: MenuProps) => {
        const [searchQuery, setSearchQuery] = useState('');
        const [selectedIndex, setSelectedIndex] = useState(0);

        const changeSearchQuery = useCallback((query: string) => {
            setSearchQuery(query);
            setSelectedIndex(0);
        }, []);

        const groups = useMemo(() => {
            return groupSchemata(
                getMatchingNodes(searchQuery, schemata, categories),
                categories,
                favorites,
                suggestions
            );
        }, [searchQuery, schemata, categories, favorites, suggestions]);
        const flatGroups = useMemo(() => groups.flatMap((group) => group.schemata), [groups]);

        const onClickHandler = useCallback(
            (schema: NodeSchema) => {
                changeSearchQuery('');
                onSelect(schema);
            },
            [changeSearchQuery, onSelect]
        );
        const onEnterHandler = useCallback(() => {
            if (selectedIndex >= 0 && selectedIndex < flatGroups.length) {
                onClickHandler(flatGroups[selectedIndex]);
            }
        }, [flatGroups, onClickHandler, selectedIndex]);

        const keydownHandler = useCallback(
            (e: KeyboardEvent) => {
                if (e.key === 'ArrowDown') {
                    setSelectedIndex((i) => clampWithWrap(0, flatGroups.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                    setSelectedIndex((i) => clampWithWrap(0, flatGroups.length - 1, i - 1));
                }
            },
            [flatGroups]
        );
        useEffect(() => {
            window.addEventListener('keydown', keydownHandler);
            return () => window.removeEventListener('keydown', keydownHandler);
        }, [keydownHandler]);

        const scrollRef = useRef<HTMLDivElement>(null);
        useEffect(() => {
            scrollRef.current?.scrollIntoView({
                block: 'center',
                inline: 'nearest',
            });
        }, [selectedIndex]);

        const menuBgColor = useThemeColor('--bg-800');
        const inputColor = 'var(--fg-300)';

        return (
            <MenuList
                bgColor={menuBgColor}
                borderRadius="md"
                borderWidth={0}
                className="nodrag"
                overflow="hidden"
                p={0}
                onContextMenu={stopPropagation}
            >
                <InputGroup
                    borderBottomWidth={1}
                    borderRadius={0}
                >
                    <InputLeftElement
                        color={inputColor}
                        pointerEvents="none"
                    >
                        <SearchIcon />
                    </InputLeftElement>
                    <Input
                        autoFocus
                        borderRadius="md"
                        placeholder="Search..."
                        spellCheck={false}
                        type="text"
                        value={searchQuery}
                        variant="filled"
                        onChange={(e) => changeSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onEnterHandler();
                            }
                        }}
                    />
                    <InputRightElement
                        _hover={{ color: 'var(--fg-000)' }}
                        style={{
                            color: inputColor,
                            cursor: 'pointer',
                            display: searchQuery ? undefined : 'none',
                            fontSize: '66%',
                        }}
                        onClick={() => changeSearchQuery('')}
                    >
                        <CloseIcon />
                    </InputRightElement>
                </InputGroup>
                <Box
                    h="auto"
                    maxH="calc(min(400px, 50vh - 50px))"
                    overflowY="scroll"
                    p={1}
                >
                    {groups.map((group, groupIndex) => {
                        const indexOffset = groups
                            .slice(0, groupIndex)
                            .reduce((acc, g) => acc + g.schemata.length, 0);

                        const nodeHeight = 28;
                        const nodePadding = 2;
                        const placeholderHeight =
                            nodeHeight * group.schemata.length +
                            nodePadding * (group.schemata.length + 1);

                        return (
                            <Box key={group.categoryId ?? group.type}>
                                <HStack
                                    borderRadius="md"
                                    mx={1}
                                    py={0.5}
                                >
                                    {renderGroupIcon(categories, group)}
                                    <Text fontSize="xs">{group.name}</Text>
                                </HStack>

                                <IfVisible
                                    forceVisible={
                                        indexOffset <= selectedIndex &&
                                        selectedIndex < indexOffset + group.schemata.length
                                    }
                                    height={placeholderHeight}
                                >
                                    {group.schemata.map((schema, schemaIndex) => {
                                        const index = indexOffset + schemaIndex;
                                        const isSelected = selectedIndex === index;

                                        return (
                                            <SchemaItem
                                                accentColor={getCategoryAccentColor(
                                                    categories,
                                                    schema.category
                                                )}
                                                isFavorite={favorites.has(schema.schemaId)}
                                                isSelected={isSelected}
                                                key={schema.schemaId}
                                                schema={schema}
                                                scrollRef={isSelected ? scrollRef : undefined}
                                                onClick={onClickHandler}
                                            />
                                        );
                                    })}
                                </IfVisible>
                            </Box>
                        );
                    })}

                    {groups.length === 0 && (
                        <Center
                            opacity="50%"
                            w="full"
                        >
                            No compatible nodes found.
                        </Center>
                    )}
                </Box>
            </MenuList>
        );
    }
);
