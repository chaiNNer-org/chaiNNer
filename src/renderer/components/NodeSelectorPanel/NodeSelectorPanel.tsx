import {
    Accordion,
    AccordionItem,
    Box,
    Button,
    Center,
    ExpandedIndex,
    HStack,
    Icon,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { memo, useMemo, useState } from 'react';
import { BsCaretDownFill, BsCaretLeftFill, BsCaretRightFill, BsCaretUpFill } from 'react-icons/bs';
import { useContext } from 'use-context-selector';
import { groupBy } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { DependencyContext } from '../../contexts/DependencyContext';
import { getMatchingNodes } from '../../helpers/nodeSearchFuncs';
import { useNodeFavorites } from '../../hooks/useNodeFavorites';
import { useStored } from '../../hooks/useStored';
import { SearchBar } from '../SearchBar';
import { FavoritesAccordionItem } from './FavoritesAccordionItem';
import { PackageHint, RegularAccordionItem, Subcategories } from './RegularAccordionItem';
import { TextBox } from './TextBox';

export const NodeSelector = memo(() => {
    const { schemata, categories, categoriesMissingNodes } = useContext(BackendContext);
    const { openDependencyManager } = useContext(DependencyContext);

    const [searchQuery, setSearchQuery] = useState('');

    const matchingNodes = getMatchingNodes(
        searchQuery,
        schemata.schemata.filter((s) => !s.deprecated),
        categories
    );
    const byCategories = useMemo(() => groupBy(matchingNodes, 'category'), [matchingNodes]);

    const [collapsed, setCollapsed] = useStored('nodeSelectorCollapsed', false);

    const { favorites } = useNodeFavorites();
    const favoriteNodes = useMemo(() => {
        return [...byCategories.values()].flat().filter((n) => favorites.has(n.schemaId));
    }, [byCategories, favorites]);

    const [showCollapseButtons, setShowCollapseButtons] = useState(false);

    const defaultIndex = Array.from({ length: byCategories.size + 1 }, (_, i) => i);
    const [accordionIndex, setAccordionIndex] = useState<ExpandedIndex>(defaultIndex);

    const accordionIsCollapsed = typeof accordionIndex !== 'number' && accordionIndex.length === 0;

    const toggleAccordion = () => {
        if (accordionIsCollapsed) {
            setAccordionIndex(defaultIndex);
        } else {
            setAccordionIndex([]);
        }
    };

    return (
        <HStack
            h="full"
            mr={-5}
            pr={0}
            onMouseEnter={() => setShowCollapseButtons(true)}
            onMouseLeave={() => setShowCollapseButtons(false)}
        >
            <Box
                bg="var(--node-selector-bg)"
                borderRadius="lg"
                borderWidth="0px"
                h="100%"
            >
                <motion.div
                    animate={{ width: collapsed ? '76px' : '300px' }}
                    initial={false}
                    transition={{ ease: 'easeInOut', duration: 0.25 }}
                >
                    <Tabs
                        isFitted
                        h="100%"
                        w="100%"
                    >
                        <TabList h="42px">
                            {!collapsed && (
                                <Tab
                                    _active={{}}
                                    _hover={{}}
                                    cursor="default"
                                >
                                    Nodes
                                </Tab>
                            )}
                        </TabList>
                        <TabPanels>
                            <TabPanel
                                m={0}
                                overflowX="hidden"
                                p={0}
                                position="relative"
                            >
                                <SearchBar
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCollapsed(false);
                                    }}
                                    onClick={() => setCollapsed(false)}
                                    onClose={() => setSearchQuery('')}
                                />
                                <Box
                                    h="calc(100vh - 165px)"
                                    overflowX="hidden"
                                    overflowY="scroll"
                                >
                                    <Center>
                                        <Button
                                            _hover={{
                                                bg: 'var(--bg-600)',
                                                opacity: 1,
                                            }}
                                            aria-label="Collapse/Expand Categories"
                                            bg="var(--bg-700)"
                                            borderRadius="0px 0px 8px 8px"
                                            h="0.5rem"
                                            opacity={showCollapseButtons ? 0.75 : 0}
                                            position="absolute"
                                            top="40px"
                                            w={collapsed ? 'auto' : '100px'}
                                            zIndex={999}
                                            onClick={toggleAccordion}
                                        >
                                            <Icon
                                                h="14px"
                                                pt="2px"
                                                w="20px"
                                            >
                                                {accordionIsCollapsed ? (
                                                    <BsCaretDownFill />
                                                ) : (
                                                    <BsCaretUpFill />
                                                )}
                                            </Icon>
                                        </Button>
                                    </Center>
                                    <Accordion
                                        allowMultiple
                                        defaultIndex={defaultIndex}
                                        index={accordionIndex}
                                        onChange={(event) => setAccordionIndex(event)}
                                    >
                                        <FavoritesAccordionItem
                                            collapsed={collapsed}
                                            favoriteNodes={favoriteNodes}
                                            noFavorites={favorites.size === 0}
                                        />
                                        {categories.categories.map((category) => {
                                            const categoryNodes = byCategories.get(category.id);
                                            const categoryIsMissingNodes =
                                                categoriesMissingNodes.includes(category.id);

                                            if (!categoryNodes && !categoryIsMissingNodes) {
                                                return null;
                                            }

                                            return (
                                                <RegularAccordionItem
                                                    category={category}
                                                    collapsed={collapsed}
                                                    key={category.id}
                                                >
                                                    {categoryIsMissingNodes && (
                                                        <PackageHint
                                                            collapsed={collapsed}
                                                            hint={category.installHint ?? ''}
                                                            packageName={category.name}
                                                            onClick={openDependencyManager}
                                                        />
                                                    )}
                                                    {categoryNodes && (
                                                        <Subcategories
                                                            category={category}
                                                            categoryNodes={categoryNodes}
                                                            collapsed={collapsed}
                                                        />
                                                    )}
                                                </RegularAccordionItem>
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
                                                    onClick={openDependencyManager}
                                                />
                                            </Box>
                                        </AccordionItem>
                                    </Accordion>
                                </Box>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </motion.div>
            </Box>
            <Button
                _hover={{
                    bg: 'var(--bg-600)',
                    opacity: 1,
                }}
                aria-label="collapse"
                bg="var(--bg-700)"
                borderRadius={0}
                borderRightRadius="xl"
                h="100px"
                left={-2}
                opacity={showCollapseButtons ? 0.75 : 0}
                position="relative"
                size="none"
                w="0.75rem"
                zIndex={999}
                onClick={() => setCollapsed(!collapsed)}
            >
                <Icon
                    pl={1}
                    pos="relative"
                    top="2px"
                >
                    {collapsed ? <BsCaretRightFill /> : <BsCaretLeftFill />}
                </Icon>
            </Button>
        </HStack>
    );
});
