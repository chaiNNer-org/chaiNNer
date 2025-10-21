import {
    Box,
    HStack,
    Icon,
    IconButton,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Tooltip,
} from '@chakra-ui/react';
import MiniSearch from 'minisearch';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { useContext } from 'use-context-selector';
import { CategoryMap } from '../../../common/CategoryMap';
import { NodeSchema, SchemaId } from '../../../common/common-types';
import { escapeRegExp } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { HighlightContainer } from './HighlightContainer';
import { NodeDocs } from './NodeDocs';
import { NodesList } from './NodesList';

const createSearchIndex = (schemata: readonly NodeSchema[], categories: CategoryMap) => {
    const idField: keyof NodeSchema = 'schemaId';
    const fields: (keyof NodeSchema)[] = [
        'category',
        'nodeGroup',
        'description',
        'name',
        'inputs',
        'outputs',
    ];

    const index = new MiniSearch<NodeSchema>({
        idField,
        fields,

        extractField: (document, fieldName): string => {
            if (fieldName === 'inputs' || fieldName === 'outputs') {
                return document[fieldName]
                    .map((i) => `${i.label} ${i.description ?? ''}`)
                    .join('\n\n');
            }
            if (fieldName === 'category') {
                const categoryId = document[fieldName];
                return categories.get(categoryId)?.name ?? categoryId;
            }
            if (fieldName === 'nodeGroup') {
                const nodeGroupId = document[fieldName];
                return categories.getGroup(nodeGroupId)?.name ?? nodeGroupId;
            }
            return String((document as unknown as Record<string, unknown>)[fieldName]);
        },
    });
    index.addAll(schemata);
    return index;
};

const NodeDocumentationModal = memo(() => {
    const { t } = useTranslation();
    const { selectedSchemaId, isOpen, openNodeDocumentation, onClose } =
        useContext(NodeDocumentationContext);
    const { schemata, categories } = useContext(BackendContext);

    const selectedSchema = schemata.get(selectedSchemaId);

    // search
    const searchIndex = useMemo(
        () => createSearchIndex(schemata.schemata, categories),
        [schemata.schemata, categories]
    );
    const [searchQuery, setSearchQuery] = useState('');
    const { searchScores, searchTerms } = useMemo(() => {
        if (!searchQuery.trim()) return {};

        const searchResults = searchIndex.search(searchQuery, {
            boost: { name: 2 },
            fuzzy: 0.2,
            prefix: true,
            combineWith: 'AND',
        });

        const terms = new Set(
            searchResults.flatMap((r) => r.terms).map((term) => term.toLowerCase())
        );

        const scores = new Map<SchemaId, number>();
        for (const result of searchResults) {
            const id = String(result.id) as SchemaId;
            scores.set(id, result.score);
        }
        return { searchScores: scores, searchTerms: terms };
    }, [searchIndex, searchQuery]);

    const highlightRegex = useMemo(() => {
        if (!searchTerms) return undefined;
        return RegExp(`(?:${[...searchTerms].map(escapeRegExp).join('|')})(?!\\w)`, 'gi');
    }, [searchTerms]);

    // select highest scoring schema
    useEffect(() => {
        if (isOpen && searchScores && searchScores.size > 0) {
            const highestScore = Math.max(...searchScores.values());
            const highestScoreSchemaId = [...searchScores.entries()].find(
                ([, score]) => score === highestScore
            )?.[0];
            if (highestScoreSchemaId) {
                openNodeDocumentation(highestScoreSchemaId);
            }
        }
    }, [isOpen, searchScores, openNodeDocumentation]);

    return (
        <Modal
            isCentered
            isOpen={isOpen}
            returnFocusOnClose={false}
            size="xl"
            onClose={onClose}
        >
            <ModalOverlay />
            <ModalContent
                bgColor="var(--chain-editor-bg)"
                h="calc(100% - 7.5rem)"
                maxW="unset"
                my={0}
                overflow="hidden"
                w="calc(100% - 7.5rem)"
            >
                <ModalHeader>
                    <HStack w="full">
                        <Box
                            display="flex"
                            h="full"
                        >
                            <Icon
                                as={BsFillJournalBookmarkFill}
                                m="auto"
                            />
                        </Box>
                        <Box whiteSpace="nowrap">
                            {t('documentation.title', 'Node Documentation')}
                        </Box>
                    </HStack>
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody
                    overflow="hidden"
                    position="relative"
                    px={4}
                >
                    <HStack
                        h="full"
                        w="full"
                    >
                        <NodesList
                            searchQuery={searchQuery}
                            searchScores={searchScores}
                            selectedSchemaId={selectedSchemaId}
                            setSearchQuery={setSearchQuery}
                            setSelectedSchemaId={openNodeDocumentation}
                        />
                        <HighlightContainer search={highlightRegex}>
                            <NodeDocs schema={selectedSchema} />
                        </HighlightContainer>
                    </HStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
});

export const NodeDocumentationButton = memo(() => {
    const { t } = useTranslation();
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);

    return (
        <>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label={t('documentation.title', 'Node Documentation')}
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('documentation.title', 'Node Documentation')}
                    icon={<BsFillJournalBookmarkFill />}
                    size="md"
                    variant="outline"
                    onClick={() => openNodeDocumentation()}
                >
                    {t('documentation.title', 'Node Documentation')}
                </IconButton>
            </Tooltip>
            <NodeDocumentationModal />
        </>
    );
});
