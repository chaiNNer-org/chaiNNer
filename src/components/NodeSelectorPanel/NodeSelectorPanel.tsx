import { SearchIcon } from '@chakra-ui/icons';
import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Center,
    Heading,
    HStack,
    Input,
    InputGroup,
    InputLeftElement,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Text,
    useColorModeValue,
    useDisclosure,
} from '@chakra-ui/react';
import { ChangeEvent, memo, useMemo, useState } from 'react';
import { NodeSchema } from '../../common-types';
import getNodeAccentColor from '../../helpers/getNodeAccentColors';
import { SchemaMap } from '../../helpers/SchemaMap';
import { IconFactory } from '../CustomIcons';
import DependencyManager from '../DependencyManager';
import RepresentativeNodeWrapper from './RepresentativeNodeWrapper';
import SubcategoryHeading from './SubcategoryHeading';

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

const NodeSelector = ({ schemata, height }: NodeSelectorProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
        setSearchQuery(event.target.value);
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

    return (
        <Box
            bg={useColorModeValue('gray.100', 'gray.800')}
            borderRadius="lg"
            borderWidth="1px"
            h="100%"
            w="auto"
        >
            <Tabs
                isFitted
                h="100%"
                w="100%"
            >
                <TabList>
                    <Tab>Nodes</Tab>
                    <Tab isDisabled>Presets</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel
                        m={0}
                        p={0}
                    >
                        <InputGroup borderRadius={0}>
                            <InputLeftElement pointerEvents="none">
                                <SearchIcon color="gray.300" />
                            </InputLeftElement>
                            <Input
                                borderRadius={0}
                                placeholder="Search..."
                                type="text"
                                variant="filled"
                                onChange={handleChange}
                            />
                        </InputGroup>
                        <Box
                            h={height - 165}
                            overflowY="scroll"
                            sx={{
                                '&::-webkit-scrollbar': {
                                    width: '6px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(0, 0, 0, 0)',
                                },
                                '&::-webkit-scrollbar-track': {
                                    borderRadius: '8px',
                                    width: '8px',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    borderRadius: '8px',
                                    backgroundColor: useColorModeValue('gray.300', 'gray.700'),
                                },
                            }}
                        >
                            <Accordion
                                allowMultiple
                                defaultIndex={schemata.schemata.map((item, index) => index)}
                            >
                                {[...byCategories].map(([category, categoryNodes]) => {
                                    const subcategoryMap = getSubcategories(categoryNodes);

                                    return (
                                        <AccordionItem key={category}>
                                            <AccordionButton>
                                                <HStack
                                                    flex="1"
                                                    textAlign="left"
                                                >
                                                    {IconFactory(
                                                        category,
                                                        getNodeAccentColor(category)
                                                    )}
                                                    <Heading size="5xl">{category}</Heading>
                                                </HStack>
                                                <AccordionIcon />
                                            </AccordionButton>
                                            <AccordionPanel>
                                                {[...subcategoryMap].map(([subcategory, nodes]) => (
                                                    <Box key={subcategory}>
                                                        <Center w="full">
                                                            <SubcategoryHeading
                                                                subcategory={subcategory}
                                                            />
                                                        </Center>
                                                        <Box>
                                                            {nodes
                                                                .filter(
                                                                    (e) =>
                                                                        e.nodeType !==
                                                                        'iteratorHelper'
                                                                )
                                                                .map((node) => (
                                                                    <RepresentativeNodeWrapper
                                                                        key={node.name}
                                                                        node={node}
                                                                    />
                                                                ))}
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </AccordionPanel>
                                        </AccordionItem>
                                    );
                                })}
                                <AccordionItem>
                                    <Center
                                        p={5}
                                        textOverflow="ellipsis"
                                    >
                                        <Box
                                            _hover={{
                                                backgroundColor: 'gray.600',
                                            }}
                                            bg={useColorModeValue('gray.200', 'gray.700')}
                                            borderRadius={10}
                                            cursor="pointer"
                                            p={2}
                                            sx={{
                                                cursor: 'pointer !important',
                                                transition: '0.15s ease-in-out',
                                            }}
                                            onClick={onOpen}
                                        >
                                            <Text
                                                cursor="pointer"
                                                fontWeight="bold"
                                                sx={{
                                                    cursor: 'pointer !important',
                                                }}
                                                textAlign="center"
                                            >
                                                Missing nodes? Check the dependency manager!
                                            </Text>
                                        </Box>
                                    </Center>
                                    {/* TODO: Replace this with a single instance of the
                   dep manager that shares a global open/close state */}
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
};

export default memo(NodeSelector);
