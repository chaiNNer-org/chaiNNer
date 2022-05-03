import { SearchIcon } from '@chakra-ui/icons';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Center,
  Divider,
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
  Tooltip,
  useColorModeValue,
  useDisclosure,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { ChangeEvent, DragEvent, memo, useContext, useState } from 'react';
import { NodeSchema } from '../common-types';
import { GlobalContext } from '../helpers/contexts/GlobalNodeState';
import getNodeAccentColor from '../helpers/getNodeAccentColors';
import { IconFactory } from './CustomIcons';
import DependencyManager from './DependencyManager';
import RepresentativeNode from './node/RepresentativeNode';

const onDragStart = (event: DragEvent<HTMLDivElement>, nodeCategory: string, node: NodeSchema) => {
  event.dataTransfer.setData('application/reactflow/schema', JSON.stringify(node));
  event.dataTransfer.setData('application/reactflow/category', nodeCategory);
  event.dataTransfer.setData('application/reactflow/offsetX', String(event.nativeEvent.offsetX));
  event.dataTransfer.setData('application/reactflow/offsetY', String(event.nativeEvent.offsetY));
  // eslint-disable-next-line no-param-reassign
  event.dataTransfer.effectAllowed = 'move';
};

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

/**
 * Returns a map that maps for sub category name to all nodes of that sub category.
 *
 * The nodes per namespace are sorted by name.
 */
const getNamespaces = (nodes: readonly NodeSchema[]) => {
  const map = new Map<string, NodeSchema[]>();
  [...nodes]
    .sort((a, b) => {
      let keyA = a.subcategory.toUpperCase();
      let keyB = b.subcategory.toUpperCase();
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      keyA = a.name.toUpperCase();
      keyB = b.name.toUpperCase();
      return keyA.localeCompare(keyB);
    })
    .forEach((n) => {
      const list = map.get(n.subcategory) ?? [];
      map.set(n.subcategory, list);
      list.push(n);
    });
  return map;
};

interface NodeSelectorProps {
  height: number;
  data: { category: string; nodes: readonly NodeSchema[] }[];
}

const NodeSelector = ({ data, height }: NodeSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const { createNode, reactFlowInstance, reactFlowWrapper, useHoveredNode } =
    useContext(GlobalContext);

  const [, setHoveredNode] = useHoveredNode;

  const matchesSearchQuery = createSearchPredicate(searchQuery);

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
                defaultIndex={data.map((item, index) => index)}
              >
                {data.map(({ category, nodes: categoryNodes }) => {
                  const matchingNodes = matchesSearchQuery(category)
                    ? categoryNodes
                    : categoryNodes.filter(
                        (n) =>
                          matchesSearchQuery(`${category} ${n.name}`) ||
                          matchesSearchQuery(`${n.subcategory} ${n.name}`)
                      );

                  // don't show categories without nodes
                  if (matchingNodes.length === 0) return null;

                  const namespaceMap = getNamespaces(matchingNodes);

                  return (
                    <AccordionItem key={category}>
                      <AccordionButton>
                        <HStack
                          flex="1"
                          textAlign="left"
                        >
                          {IconFactory(category, getNodeAccentColor(category))}
                          <Heading size="5xl">{category}</Heading>
                        </HStack>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel>
                        {[...namespaceMap].map(([namespace, nodes]) => (
                          <Box key={namespace}>
                            <Center w="full">
                              <HStack w="full">
                                <Divider orientation="horizontal" />
                                <Text
                                  casing="uppercase"
                                  color="#71809699"
                                  fontSize="sm"
                                  w="auto"
                                  whiteSpace="nowrap"
                                >
                                  {namespace}
                                </Text>
                                <Divider orientation="horizontal" />
                              </HStack>
                            </Center>
                            <Wrap>
                              {nodes
                                .filter((e) => e.nodeType !== 'iteratorHelper')
                                .map((node) => (
                                  <WrapItem
                                    key={node.name}
                                    p={1}
                                    w="full"
                                  >
                                    <Tooltip
                                      closeOnMouseDown
                                      hasArrow
                                      borderRadius={8}
                                      label={node.description}
                                      px={2}
                                      py={1}
                                    >
                                      <Center
                                        draggable
                                        boxSizing="content-box"
                                        display="block"
                                        w="100%"
                                        onDoubleClick={() => {
                                          if (!reactFlowInstance) return;

                                          const { height: wHeight, width } =
                                            reactFlowWrapper.current.getBoundingClientRect();

                                          const position = reactFlowInstance.project({
                                            x: width / 2,
                                            y: wHeight / 2,
                                          });

                                          createNode({
                                            nodeType: node.nodeType,
                                            position,
                                            data: {
                                              category,
                                              subcategory: node.subcategory,
                                              type: node.name,
                                              icon: node.icon,
                                            },
                                            defaultNodes: node.defaultNodes,
                                          });
                                        }}
                                        onDragEnd={() => {
                                          setHoveredNode(null);
                                        }}
                                        onDragStart={(event) => {
                                          onDragStart(event, category, node);
                                          setHoveredNode(null);
                                        }}
                                      >
                                        <RepresentativeNode
                                          category={category}
                                          icon={node.icon}
                                          subcategory={node.subcategory}
                                          type={node.name}
                                        />
                                      </Center>
                                    </Tooltip>
                                  </WrapItem>
                                ))}
                            </Wrap>
                          </Box>
                        ))}
                      </AccordionPanel>
                    </AccordionItem>
                  );
                })}
                <AccordionItem>
                  <Center
                    p={10}
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
                      pl={4}
                      pr={4}
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
