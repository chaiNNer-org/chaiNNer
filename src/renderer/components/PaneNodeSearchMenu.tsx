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
import { useTranslation } from 'react-i18next';
import { VscLightbulbAutofix } from 'react-icons/vsc';
import { CategoryMap } from '../../common/CategoryMap';
import {
    Category,
    CategoryId,
    FeatureId,
    FeatureState,
    InputData,
    NodeSchema,
    SchemaId,
    SpecialSuggestion,
} from '../../common/common-types';
import { assertNever, cacheLast, groupBy, stopPropagation } from '../../common/util';
import { getCategoryAccentColor } from '../helpers/accentColors';
import { interpolateColor } from '../helpers/colorTools';
import { getBestMatch, getMatchingNodes } from '../helpers/nodeSearchFuncs';
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
    name: string;
    icon: string;
    isFavorite: boolean;
    accentColor: string;
    onClick: () => void;
    isSelected: boolean;
    scrollRef?: React.RefObject<HTMLDivElement>;
}
const SchemaItem = memo(
    ({ name, icon, onClick, isFavorite, accentColor, isSelected, scrollRef }: SchemaItemProps) => {
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
                mx={1}
                my={0.5}
                outline={isSelected ? '1px solid' : undefined}
                px={2}
                py={0.5}
                ref={scrollRef}
                onClick={onClick}
            >
                <IconFactory
                    accentColor="var(--pane-icon)"
                    icon={icon}
                />
                <Text
                    flex={1}
                    h="full"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    verticalAlign="middle"
                    whiteSpace="nowrap"
                >
                    {name}
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

type GroupItem = SchemaGroupItem | SuggestionGroupItem;
interface GroupItemBase {
    readonly name: string;
    readonly icon: string;
    readonly schema: NodeSchema;
}
interface SchemaGroupItem extends GroupItemBase {
    readonly type: 'schema';
    readonly inputs?: undefined;
}
interface SuggestionGroupItem extends GroupItemBase {
    readonly type: 'suggestion';
    readonly inputs: Partial<InputData>;
}

type SchemaGroup = FavoritesSchemaGroup | SuggestedSchemaGroup | CategorySchemaGroup;
interface SchemaGroupBase {
    readonly name: string;
    readonly items: readonly GroupItem[];
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
    suggested: ReadonlySet<SchemaId>,
    specialSuggestions: readonly SuggestionGroupItem[]
): readonly SchemaGroup[] => {
    const toItem = (schema: NodeSchema): SchemaGroupItem => {
        return {
            type: 'schema',
            name: schema.name,
            icon: schema.icon,
            schema,
        };
    };

    const cats = [...groupBy(schemata, 'category')].map(
        ([categoryId, categorySchemata]): CategorySchemaGroup => {
            const category = categories.get(categoryId);
            return {
                type: 'category',
                name: category?.name ?? categoryId,
                categoryId,
                category,
                items: categorySchemata.map(toItem),
            };
        }
    );

    const favs: FavoritesSchemaGroup = {
        type: 'favorites',
        name: 'Favorites',
        items: cats.flatMap((c) => c.items).filter((n) => favorites.has(n.schema.schemaId)),
    };

    const suggs: SuggestedSchemaGroup = {
        type: 'suggested',
        name: 'Suggested',
        items: [
            ...specialSuggestions,
            ...schemata.filter((n) => suggested.has(n.schemaId)).map(toItem),
        ],
    };

    return [...(suggs.items.length ? [suggs] : []), ...(favs.items.length ? [favs] : []), ...cats];
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

// eslint-disable-next-line react-memo/require-memo
function* getSpecialSuggestions(
    schemata: readonly NodeSchema[],
    searchQuery: string
): Iterable<SuggestionGroupItem> {
    const equalIgnoreCase = (a: string, b: string) => {
        // the length check isn't 100% correct, but it's good enough for our mostly-ASCII suggestions
        return a.length === b.length && a.toLowerCase() === b.toLowerCase();
    };

    const parse = (
        s: SpecialSuggestion,
        schema: NodeSchema
    ): { inputs: Partial<InputData> } | undefined => {
        if (equalIgnoreCase(searchQuery, s.query)) {
            return { inputs: s.inputs };
        }
        if (s.parseInput != null && searchQuery.startsWith(s.query)) {
            const rest = searchQuery.slice(s.query.length);
            const input = schema.inputs.find((i) => i.id === s.parseInput);
            if (input) {
                // attempt to parse the rest of the query string
                if (input.kind === 'number') {
                    const value = parseFloat(rest.trim());
                    if (!Number.isNaN(value)) {
                        return { inputs: { ...s.inputs, [input.id]: value } };
                    }
                }
            }
        }
        return undefined;
    };

    for (const schema of schemata) {
        for (const suggestion of schema.suggestions) {
            const parsed = parse(suggestion, schema);
            if (parsed) {
                yield {
                    type: 'suggestion',
                    icon: schema.icon,
                    name: suggestion.name ?? schema.name,
                    schema,
                    inputs: parsed.inputs,
                };
            }
        }
    }
}

const createMatcher = (
    schemata: readonly NodeSchema[],
    categories: CategoryMap,
    favorites: ReadonlySet<SchemaId>,
    suggestions: ReadonlySet<SchemaId>,
    featureStates: ReadonlyMap<FeatureId, FeatureState>
) => {
    return cacheLast((searchQuery: string) => {
        const specialSuggestions = [...getSpecialSuggestions(schemata, searchQuery)];
        const matchingNodes = getMatchingNodes(searchQuery, schemata, categories);
        const groups = groupSchemata(
            matchingNodes,
            categories,
            favorites,
            suggestions,
            specialSuggestions
        );
        const flatGroups: readonly GroupItem[] = groups.flatMap((group) => group.items);

        const bestSchema = getBestMatch(searchQuery, matchingNodes, categories, (schema) => {
            const isFeatureEnabled = schema.features.every((f) => {
                return featureStates.get(f)?.enabled ?? false;
            });
            if (!isFeatureEnabled) {
                // don't suggest nodes that are not available
                return 0;
            }

            if (favorites.has(schema.schemaId)) {
                // boost favorites
                return 2;
            }
            return 1;
        });
        const bestMatch = flatGroups.find((item) => item.schema === bestSchema);

        return { groups, flatGroups, bestMatch };
    });
};

interface MenuProps {
    onSelect: (schema: NodeSchema, inputs: Partial<InputData>) => void;
    schemata: readonly NodeSchema[];
    favorites: ReadonlySet<SchemaId>;
    categories: CategoryMap;
    suggestions: ReadonlySet<SchemaId>;
    featureStates: ReadonlyMap<FeatureId, FeatureState>;
}

export const Menu = memo(
    ({ onSelect, schemata, favorites, categories, suggestions, featureStates }: MenuProps) => {
        const { t } = useTranslation();
        const [searchQuery, setSearchQuery] = useState('');
        const [selectedIndex, setSelectedIndex] = useState(0);

        const matcher = useMemo(
            () => createMatcher(schemata, categories, favorites, suggestions, featureStates),
            [schemata, categories, favorites, suggestions, featureStates]
        );

        const changeSearchQuery = useCallback(
            (query: string) => {
                setSearchQuery(query);

                let index = 0;
                if (query) {
                    const { flatGroups, bestMatch } = matcher(query);
                    index = bestMatch ? flatGroups.indexOf(bestMatch) : 0;
                }
                setSelectedIndex(index);
            },
            [matcher]
        );

        const { groups, flatGroups } = useMemo(() => matcher(searchQuery), [searchQuery, matcher]);

        const onClickHandler = useCallback(
            (item: GroupItem) => {
                changeSearchQuery('');
                onSelect(item.schema, item.inputs ?? {});
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
                        placeholder={t('search.placeholder', 'Search...')}
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
                            .reduce((acc, g) => acc + g.items.length, 0);

                        const nodeHeight = 28;
                        const nodePadding = 2;
                        const placeholderHeight =
                            nodeHeight * group.items.length +
                            nodePadding * (group.items.length + 1);

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
                                        selectedIndex < indexOffset + group.items.length
                                    }
                                    height={placeholderHeight}
                                >
                                    {group.items.map((item, itemIndex) => {
                                        const index = indexOffset + itemIndex;
                                        const isSelected = selectedIndex === index;

                                        return (
                                            <SchemaItem
                                                accentColor={getCategoryAccentColor(
                                                    categories,
                                                    item.schema.category
                                                )}
                                                icon={item.icon}
                                                isFavorite={favorites.has(item.schema.schemaId)}
                                                isSelected={isSelected}
                                                key={item.schema.schemaId}
                                                name={item.name}
                                                scrollRef={isSelected ? scrollRef : undefined}
                                                onClick={() => {
                                                    onClickHandler(item);
                                                }}
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
