import {
    Box,
    HStack,
    Icon,
    IconButton,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Tooltip,
} from '@chakra-ui/react';
import { memo, useState } from 'react';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { useContext } from 'use-context-selector';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { NodeDocs } from './NodeDocs';
import { NodesList } from './NodesList';

interface NodeDocumentationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NodeDocumentationModal = memo(({ isOpen, onClose }: NodeDocumentationModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    return (
        <Modal
            isCentered
            isOpen={isOpen}
            // scrollBehavior="inside"
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
                <ModalHeader
                // display="flex"
                // flexDirection="row"
                // gap={2}
                >
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
                        <Box whiteSpace="nowrap">Node Documentation</Box>
                        <Input
                            placeholder="Search..."
                            value={searchQuery}
                            w="full"
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Box w={8} />
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
                        <NodesList searchQuery={searchQuery} />
                        <NodeDocs />
                    </HStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
});

export const NodeDocumentationButton = memo(() => {
    const { selectedSchemaId, isOpen, openNodeDocumentation, onClose } =
        useContext(NodeDocumentationContext);
    return (
        <>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label="Node Documentation"
                px={2}
                py={1}
            >
                <IconButton
                    aria-label="Node Documentation"
                    icon={<BsFillJournalBookmarkFill />}
                    size="md"
                    variant="outline"
                    onClick={() => {
                        openNodeDocumentation(selectedSchemaId);
                    }}
                >
                    Node Documentation
                </IconButton>
            </Tooltip>
            <NodeDocumentationModal
                isOpen={isOpen}
                onClose={onClose}
            />
        </>
    );
});
