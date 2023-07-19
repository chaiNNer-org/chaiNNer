import { Box, Center, HStack, Text, VStack } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useContext } from 'use-context-selector';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { getNodesByCategory } from '../../helpers/nodeSearchFuncs';
import { IconFactory } from '../CustomIcons';
import { SearchBar } from '../SearchBar';

export const NodesList = memo(() => {
    const { selectedSchemaId, isOpen, openNodeDocumentation, nodeDocsSearchState } =
        useContext(NodeDocumentationContext);

    const { schemata, categories } = useContext(BackendContext);
    const schema = schemata.schemata;

    const { searchQuery, setSearchQuery, searchResults } = nodeDocsSearchState;

    const scoreMap = useMemo(() => {
        const map = new Map<string, number>();
        searchResults.forEach((result) => {
            map.set(String(result.id), result.score);
        });
        return map;
    }, [searchResults]);

    const matchingSchemaIds = useMemo(
        () => searchResults.map((s) => String(s.id)),
        [searchResults]
    );
    const filteredSchema = useMemo(
        () => schema.filter((s) => !searchQuery || matchingSchemaIds.includes(s.schemaId)),
        [matchingSchemaIds, schema, searchQuery]
    );

    const byCategories = useMemo(() => getNodesByCategory(filteredSchema), [filteredSchema]);

    const categoriesByMaxNodeScore = useMemo(
        () =>
            searchQuery
                ? [...categories].sort((a, b) => {
                      const aMaxScore = Math.max(
                          ...(byCategories.get(a.name)?.map((n) => scoreMap.get(n.schemaId) ?? 0) ??
                              [])
                      );
                      const bMaxScore = Math.max(
                          ...(byCategories.get(b.name)?.map((n) => scoreMap.get(n.schemaId) ?? 0) ??
                              [])
                      );
                      return bMaxScore - aMaxScore;
                  })
                : categories,
        [byCategories, categories, scoreMap, searchQuery]
    );

    const highestNode = useMemo(
        () =>
            byCategories
                .get(categoriesByMaxNodeScore[0].name)
                ?.sort(
                    (a, b) => (scoreMap.get(b.schemaId) ?? 0) - (scoreMap.get(a.schemaId) ?? 0)
                )[0] ?? undefined,
        [byCategories, categoriesByMaxNodeScore, scoreMap]
    );

    const prevHighestNode = useRef(highestNode);
    useEffect(() => {
        if (prevHighestNode.current?.schemaId !== highestNode?.schemaId) {
            openNodeDocumentation(highestNode?.schemaId);
            prevHighestNode.current = highestNode;
        }
    }, [highestNode, openNodeDocumentation]);

    const selectedElement = useRef<HTMLDivElement>(null);

    const [selectScrollTrigger, setSelectScrollTrigger] = useState(false);

    useEffect(() => {
        setSelectScrollTrigger(!selectScrollTrigger);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedSchemaId, setSelectScrollTrigger]);

    // This is a hack. Sometimes, I hate react.
    // Basically, if you use the menu way of opening the modal, the above useEffect will trigger
    // before the ref actually gets set, so it won't scroll to the selected element.
    // This forces it to scroll in the render after the ref is set.
    useEffect(() => {
        if (selectedElement.current) {
            selectedElement.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest',
            });
        }
    }, [selectScrollTrigger]);

    return (
        <Box
            h="full"
            w={64}
        >
            <Box w={64}>
                <VStack
                    h="full"
                    left={0}
                    maxH="full"
                    overflowY="scroll"
                    position="absolute"
                    spacing={0}
                    top={0}
                    w={64}
                >
                    <Box
                        bgColor="var(--bg-800)"
                        position="sticky"
                        top={0}
                    >
                        <SearchBar
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={() => {}}
                            onClose={() => setSearchQuery('')}
                        />
                    </Box>
                    {filteredSchema.length === 0 ? (
                        <Text>No nodes found</Text>
                    ) : (
                        categoriesByMaxNodeScore.map((category) => {
                            const categoryNodes = byCategories.get(category.name);

                            if (!categoryNodes || categoryNodes.length === 0) {
                                return null;
                            }

                            const categoryNodesByScore = searchQuery
                                ? [...categoryNodes].sort(
                                      (a, b) =>
                                          (scoreMap.get(b.schemaId) ?? 0) -
                                          (scoreMap.get(a.schemaId) ?? 0)
                                  )
                                : categoryNodes;

                            return (
                                <Box
                                    key={category.name}
                                    w="full"
                                >
                                    <Center
                                        borderBottomColor="gray.500"
                                        borderBottomWidth="1px"
                                        p={2}
                                        pt={4}
                                        w="full"
                                    >
                                        <HStack>
                                            <IconFactory
                                                accentColor={category.color}
                                                icon={category.icon}
                                            />
                                            <Text>{category.name}</Text>
                                        </HStack>
                                    </Center>
                                    {categoryNodesByScore.map((node) => {
                                        const isSelected = node.schemaId === selectedSchemaId;
                                        return (
                                            <HStack
                                                _hover={{
                                                    backgroundColor: 'var(--bg-700)',
                                                }}
                                                backgroundColor={
                                                    isSelected ? 'var(--bg-700)' : 'var(--bg-800)'
                                                }
                                                borderBottomColor="gray.500"
                                                borderBottomWidth="1px"
                                                borderLeftColor={category.color}
                                                borderLeftWidth={isSelected ? 8 : 4}
                                                cursor="pointer"
                                                key={node.schemaId}
                                                p={2}
                                                ref={isSelected ? selectedElement : undefined}
                                                w="full"
                                                onClick={() => {
                                                    openNodeDocumentation(node.schemaId);
                                                }}
                                            >
                                                <IconFactory icon={node.icon} />
                                                <Text
                                                    cursor="pointer"
                                                    key={node.schemaId}
                                                >
                                                    {node.name}
                                                </Text>
                                            </HStack>
                                        );
                                    })}
                                </Box>
                            );
                        })
                    )}
                </VStack>
            </Box>
        </Box>
    );
});
