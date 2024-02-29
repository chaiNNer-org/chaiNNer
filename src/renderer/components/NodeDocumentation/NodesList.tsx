import { Box, Center, HStack, Text, VStack } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useContext } from 'use-context-selector';
import { SchemaId } from '../../../common/common-types';
import { groupBy } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { IconFactory } from '../CustomIcons';
import { IfVisible } from '../IfVisible';
import { SearchBar } from '../SearchBar';

export interface NodesListProps {
    selectedSchemaId: SchemaId;
    setSelectedSchemaId: (schemaId: SchemaId) => void;
    searchQuery: string;
    setSearchQuery: (searchQuery: string) => void;
    searchScores: ReadonlyMap<SchemaId, number> | undefined;
}

export const NodesList = memo(
    ({
        selectedSchemaId,
        setSelectedSchemaId,
        searchQuery,
        setSearchQuery,
        searchScores,
    }: NodesListProps) => {
        const { isOpen } = useContext(NodeDocumentationContext);
        const { schemata, categories } = useContext(BackendContext);

        const filteredSchema = useMemo(() => {
            const filtered = schemata.schemata.filter((s) => !s.deprecated);
            if (!searchScores) return filtered;
            return filtered.filter((s) => searchScores.has(s.schemaId));
        }, [schemata.schemata, searchScores]);

        const byCategories = useMemo(() => groupBy(filteredSchema, 'category'), [filteredSchema]);

        const sortedCategories = useMemo(() => {
            if (!searchScores) return categories.categories;

            return [...categories.categories].sort((a, b) => {
                const aNodes = byCategories.get(a.id) ?? [];
                const bNodes = byCategories.get(b.id) ?? [];
                const aMaxScore = Math.max(...aNodes.map((n) => searchScores.get(n.schemaId) ?? 0));
                const bMaxScore = Math.max(...bNodes.map((n) => searchScores.get(n.schemaId) ?? 0));
                return bMaxScore - aMaxScore;
            });
        }, [byCategories, categories, searchScores]);

        const selectedElement = useRef<HTMLDivElement>(null);

        const [selectScrollTrigger, setSelectScrollTrigger] = useState(false);

        useEffect(() => {
            setSelectScrollTrigger((prev) => !prev);
        }, [isOpen, selectedSchemaId]);

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
                            sortedCategories.map((category) => {
                                const categoryNodes = byCategories.get(category.id);

                                if (!categoryNodes || categoryNodes.length === 0) {
                                    return null;
                                }

                                const categoryNodesByScore = searchScores
                                    ? [...categoryNodes].sort(
                                          (a, b) =>
                                              (searchScores.get(b.schemaId) ?? 0) -
                                              (searchScores.get(a.schemaId) ?? 0)
                                      )
                                    : categoryNodes;

                                return (
                                    <Box
                                        key={category.id}
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
                                        <IfVisible
                                            forceVisible={categoryNodesByScore.some(
                                                (node) => node.schemaId === selectedSchemaId
                                            )}
                                            height={41 * categoryNodesByScore.length}
                                        >
                                            {categoryNodesByScore.map((node) => {
                                                const isSelected =
                                                    node.schemaId === selectedSchemaId;
                                                return (
                                                    <HStack
                                                        _hover={{
                                                            backgroundColor: 'var(--bg-700)',
                                                        }}
                                                        backgroundColor={
                                                            isSelected
                                                                ? 'var(--bg-700)'
                                                                : 'var(--bg-800)'
                                                        }
                                                        borderBottomColor="gray.500"
                                                        borderBottomWidth="1px"
                                                        borderLeftColor={category.color}
                                                        borderLeftWidth={isSelected ? 8 : 4}
                                                        cursor="pointer"
                                                        key={node.schemaId}
                                                        p={2}
                                                        ref={
                                                            isSelected ? selectedElement : undefined
                                                        }
                                                        w="full"
                                                        onClick={() => {
                                                            setSelectedSchemaId(node.schemaId);
                                                        }}
                                                    >
                                                        <IconFactory icon={node.icon} />
                                                        <Text
                                                            cursor="pointer"
                                                            key={node.schemaId}
                                                            overflow="hidden"
                                                            textOverflow="ellipsis"
                                                            whiteSpace="nowrap"
                                                        >
                                                            {node.name}
                                                        </Text>
                                                    </HStack>
                                                );
                                            })}
                                        </IfVisible>
                                    </Box>
                                );
                            })
                        )}
                    </VStack>
                </Box>
            </Box>
        );
    }
);
