import { SearchIcon } from '@chakra-ui/icons';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Center, Divider, Heading, HStack, Input,
  InputGroup, InputLeftElement, Tab, TabList, TabPanel,
  TabPanels, Tabs, Text, Tooltip, useColorModeValue, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import {
  memo, useContext, useEffect, useState,
} from 'react';
import { GlobalContext } from '../helpers/contexts/GlobalNodeState.jsx';
import getNodeAccentColor from '../helpers/getNodeAccentColors.js';
import { IconFactory } from './CustomIcons.jsx';
import DependencyManager from './DependencyManager.jsx';
import RepresentativeNode from './node/RepresentativeNode.jsx';

const onDragStart = (event, nodeCategory, node) => {
  event.dataTransfer.setData('application/reactflow/type', node.name);
  event.dataTransfer.setData('application/reactflow/nodeType', node.nodeType);
  event.dataTransfer.setData('application/reactflow/category', nodeCategory);
  event.dataTransfer.setData('application/reactflow/icon', node.icon);
  event.dataTransfer.setData('application/reactflow/subcategory', node.subcategory);
  event.dataTransfer.setData('application/reactflow/defaultNodes', node.nodeType === 'iterator' ? JSON.stringify(node.defaultNodes) : null);

  event.dataTransfer.setData('application/reactflow/offsetX', event.nativeEvent.offsetX);
  event.dataTransfer.setData('application/reactflow/offsetY', event.nativeEvent.offsetY);
  // eslint-disable-next-line no-param-reassign
  event.dataTransfer.effectAllowed = 'move';
};

// eslint-disable-next-line react/prop-types
const NodeSelector = ({ data, height }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const handleChange = (event) => setSearchQuery(event.target.value);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [namespaces, setNamespaces] = useState([]);

  const {
    createNode, reactFlowInstance, reactFlowWrapper, useHoveredNode,
  } = useContext(GlobalContext);

  const [, setHoveredNode] = useHoveredNode;

  useEffect(() => {
    const set = {};
    data?.forEach(({ category, nodes }) => {
      nodes
        .sort(
          (a, b) => (a.subcategory + a.name)
            .toUpperCase()
            .localeCompare((b.subcategory + b.name).toUpperCase()),
        )
        .forEach((node) => {
          const namespace = node.subcategory;
          if (!set[category]) {
            set[category] = [];
          }
          if (!set[category].includes(namespace)) {
            set[category].push(namespace);
          }
        });
    });
    setNamespaces(set);
  }, [data]);

  return (
    <Box
      bg={useColorModeValue('gray.100', 'gray.800')}
      borderRadius="lg"
      borderWidth="1px"
      h="100%"
      w="auto"
    >
      <Tabs
        h="100%"
        isFitted
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
            <InputGroup
              borderRadius={0}
            >
              <InputLeftElement
                pointerEvents="none"
              >
                <SearchIcon
                  color="gray.300"
                />
              </InputLeftElement>
              <Input
                borderRadius={0}
                onChange={handleChange}
                placeholder="Search..."
                type="text"
                variant="filled"
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
                {data.map(({ category, nodes }) => (
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
                      {namespaces[category] && namespaces[category]
                      // eslint-disable-next-line max-len
                      // This is super terrible but I have no better way of filtering for these at the moment
                      // I could probably cache this in the namespace object but w/e
                        .filter(
                          (namespace) => `${category} ${namespace} ${nodes.filter((e) => e.subcategory === namespace).map((e) => e.name).join(' ')}`.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .map((namespace) => (
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
                                .filter(
                                  (e) => `${category} ${namespace} ${e.name}`.toLowerCase().includes(searchQuery.toLowerCase()),
                                )
                                .filter(
                                  (e) => e.subcategory
                                    .toUpperCase()
                                    .includes(namespace.toUpperCase()),
                                )
                                .filter((e) => e.nodeType !== 'iteratorHelper')
                                .sort(
                                  (a, b) => a.name.toUpperCase()
                                    .localeCompare(b.name.toUpperCase()),
                                )
                                .map((node) => (
                                  <WrapItem
                                    key={node.name}
                                    p={1}
                                    w="full"
                                  >
                                    <Tooltip
                                      borderRadius={8}
                                      closeOnMouseDown
                                      hasArrow
                                      label={node.description}
                                      px={2}
                                      py={1}
                                    >
                                      <Center
                                        boxSizing="content-box"
                                        display="block"
                                        draggable
                                        onDoubleClick={() => {
                                          const {
                                            height: wHeight, width,
                                          } = reactFlowWrapper.current.getBoundingClientRect();

                                          const position = reactFlowInstance.project({
                                            x: width / 2,
                                            y: wHeight / 2,
                                          });

                                          const nodeData = {
                                            category,
                                            type: node.name,
                                          };

                                          createNode({
                                            nodeType: node.nodeType,
                                            position,
                                            data: nodeData,
                                            defaultNodes: node.defaultNodes,
                                          });
                                        }}
                                        onDragEnd={() => {
                                          setHoveredNode(null);
                                        }}
                                        onDragStart={
                                            (event) => {
                                              onDragStart(event, category, node);
                                              setHoveredNode(null);
                                            }
                                          }
                                        w="100%"
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
                ))}
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
                      onClick={onOpen}
                      p={2}
                      pl={4}
                      pr={4}
                      sx={{
                        cursor: 'pointer !important',
                        transition: '0.15s ease-in-out',
                      }}
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
                    onOpen={onOpen}
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
