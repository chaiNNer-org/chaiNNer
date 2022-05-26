import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, SearchIcon } from '@chakra-ui/icons';
import {
    Accordion,
    AccordionItem,
    Box,
    IconButton,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    useColorModeValue,
    useDisclosure,
} from '@chakra-ui/react';
import { memo, useMemo, useState } from 'react';
import { NodeSchema } from '../../../common/common-types';
import { SchemaMap } from '../../../common/SchemaMap';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
import DependencyManager from '../DependencyManager';
import { FavoritesAccordionItem } from './FavoritesAccordionItem';
import { RegularAccordionItem } from './RegularAccordionItem';
import { TextBox } from './TextBox';

const createSearchPredicate = (query: string): ((name: string) => boolean) => {
    const pattern = new RegExp(
        `^${[...query]
            .map((char) => {
                const hex = `\\u{${char.codePointAt(0)!.toString(16)}}`;
                return `[^${hex}]*${hex}`;
            })
            .join('')}`,
        'iu'
    );
    return (name) => pattern.test(name);
};

const compareIgnoreCase = (a: string, b: string): number => {
    return a.toUpperCase().localeCompare(b.toUpperCase());
};

const byCategory = (nodes: readonly NodeSchema[]): Map<string, NodeSchema[]> => {
    const map = new Map<string, NodeSchema[]>();
    nodes.forEach((node) => {
        let list = map.get(node.category);
        if (list === undefined) map.set(node.category, (list = []));
        list.push(node);
    });
    return map;
};

/**
 * Returns a map that maps for sub category name to all nodes of that sub category.
 *
 * The nodes per subcategory are sorted by name.
 */
const getSubcategories = (nodes: readonly NodeSchema[]) => {
    const map = new Map<string, NodeSchema[]>();
    [...nodes]
        .sort(
            (a, b) =>
                compareIgnoreCase(a.subcategory, b.subcategory) || compareIgnoreCase(a.name, b.name)
        )
        .forEach((n) => {
            const list = map.get(n.subcategory) ?? [];
            map.set(n.subcategory, list);
            list.push(n);
        });
    return map;
};

interface NodeSelectorProps {
    height: number;
    schemata: SchemaMap;
}

const NodeSelector = memo(({ schemata, height }: NodeSelectorProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const { isOpen, onOpen, onClose } = useDisclosure();

    const matchesSearchQuery = createSearchPredicate(searchQuery);
    const matchingNodes = !searchQuery
        ? schemata.schemata
        : schemata.schemata.filter(
              (n) =>
                  matchesSearchQuery(`${n.category} ${n.name}`) ||
                  matchesSearchQuery(`${n.subcategory} ${n.name}`)
          );

    const byCategories: Map<string, NodeSchema[]> = useMemo(
        () => byCategory(matchingNodes),
        [matchingNodes]
    );

    const [collapsed, setCollapsed] = useState<boolean>(false);

    const { favorites } = useNodeFavorites();
    const favoriteNodes = useMemo(() => {
        return [...byCategories.values()].flat().filter((n) => favorites.has(n.schemaId));
    }, [byCategories, favorites]);

    return (
        <Box
            bg={useColorModeValue('gray.100', 'gray.800')}
            borderRadius="lg"
            borderWidth="1px"
            h="100%"
            w={collapsed ? '84px' : 'auto'} // TODO: Figure out how to make this auto resize to this size
        >
            <Tabs
                isFitted
                h="100%"
                w="100%"
            >
                <TabList h="42px">
                    {!collapsed && (
                        <>
                            <Tab>Nodes</Tab>
                            <Tab isDisabled>Presets</Tab>
                        </>
                    )}
                    <IconButton
                        aria-label="collapse"
                        bg="none"
                        color="gray.500"
                        h="full"
                        icon={collapsed ? <ArrowRightIcon /> : <ArrowLeftIcon />}
                        w={collapsed ? 'full' : 'auto'}
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        Collapse
                    </IconButton>
                </TabList>
                <TabPanels>
                    <TabPanel
                        m={0}
                        p={0}
                    >
                        <InputGroup borderRadius={0}>
                            <InputLeftElement
                                color={useColorModeValue('gray.500', 'gray.300')}
                                pointerEvents="none"
                            >
                                <SearchIcon />
                            </InputLeftElement>
                            <Input
                                borderRadius={0}
                                disabled={collapsed}
                                placeholder="Search..."
                                spellCheck={false}
                                type="text"
                                value={searchQuery}
                                variant="filled"
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <InputRightElement
                                _hover={{ color: useColorModeValue('black', 'white') }}
                                style={{
                                    color: useColorModeValue('gray.500', 'gray.300'),
                                    cursor: 'pointer',
                                    display: searchQuery ? undefined : 'none',
                                    fontSize: '66%',
                                }}
                                onClick={() => setSearchQuery('')}
                            >
                                <CloseIcon />
                            </InputRightElement>
                        </InputGroup>
                        <Box
                            h={height - 165}
                            overflowY="scroll"
                        >
                            <Accordion
                                allowMultiple
                                defaultIndex={schemata.schemata.map((item, index) => index)}
                            >
                                <FavoritesAccordionItem
                                    collapsed={collapsed}
                                    favoriteNodes={favoriteNodes}
                                />
                                {[...byCategories].map(([category, categoryNodes]) => {
                                    const subcategoryMap = getSubcategories(categoryNodes);

                                    return (
                                        <RegularAccordionItem
                                            category={category}
                                            collapsed={collapsed}
                                            key={category}
                                            subcategoryMap={subcategoryMap}
                                        />
                                    );
                                })}
                                <AccordionItem>
                                    <Box p={4}>
                                        <TextBox
                                            collapsed={collapsed}
                                            text="Missing nodes? Click to open the dependency manager!"
                                            toolTip={
                                                collapsed
                                                    ? 'Missing nodes? Click to open the dependency manager!'
                                                    : ''
                                            }
                                            onClick={onOpen}
                                        />
                                    </Box>
                                    {/* TODO: Replace this with a single instance of the dep manager that shares a global open/close state */}
                                    <DependencyManager
                                        isOpen={isOpen}
                                        onClose={onClose}
                                    />
                                </AccordionItem>
                            </Accordion>
                        </Box>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </Box>
    );
});

export default NodeSelector;
