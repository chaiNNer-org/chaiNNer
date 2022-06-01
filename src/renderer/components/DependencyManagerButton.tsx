import { DownloadIcon } from '@chakra-ui/icons';
import { IconButton, Tag, TagLabel, Tooltip, VStack } from '@chakra-ui/react';
import { memo } from 'react';
import { useContext } from 'use-context-selector';
import { DependencyContext } from '../contexts/DependencyContext';

export const DependencyManagerButton = memo(() => {
    const { openDependencyManager, availableUpdates } = useContext(DependencyContext);

    return (
        <Tooltip
            closeOnClick
            closeOnMouseDown
            borderRadius={8}
            label="Manage Dependencies"
            px={2}
            py={1}
        >
            <VStack
                m={0}
                spacing={0}
            >
                {availableUpdates > 0 ? (
                    <Tag
                        borderRadius="full"
                        colorScheme="red"
                        ml={-7}
                        mt={-1}
                        position="fixed"
                        size="sm"
                    >
                        <TagLabel textAlign="center">{availableUpdates}</TagLabel>
                    </Tag>
                ) : null}
                <IconButton
                    aria-label="Download button"
                    icon={<DownloadIcon />}
                    position="relative"
                    size="md"
                    variant="outline"
                    onClick={openDependencyManager}
                />
            </VStack>
        </Tooltip>
    );
});
