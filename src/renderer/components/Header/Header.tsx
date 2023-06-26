import { Box, Center, HStack, SimpleGrid } from '@chakra-ui/react';
import { memo } from 'react';
import { DependencyManagerButton } from '../DependencyManagerButton';
import { NodeDocumentationButton } from '../NodeDocumentation/NodeDocumentationModal';
import { SettingsButton } from '../SettingsModal';
import { SystemStats } from '../SystemStats';
import { AppInfo } from './AppInfo';
import { ExecutionButtons } from './ExecutionButtons';
import { KoFiButton } from './KoFiButton';

export const Header = memo(() => {
    return (
        <Box
            bg="var(--header-bg)"
            borderRadius="lg"
            borderWidth="0px"
            h="56px"
            w="100%"
        >
            <SimpleGrid
                columns={3}
                h="100%"
                p={2}
                spacing={1}
            >
                <AppInfo />

                <Center w="full">
                    <ExecutionButtons />
                </Center>

                <Box
                    alignContent="right"
                    alignItems="right"
                    w="full"
                >
                    <HStack
                        ml="auto"
                        mr={0}
                        width="fit-content"
                    >
                        <SystemStats />
                        <NodeDocumentationButton />
                        <DependencyManagerButton />
                        <KoFiButton />
                        <SettingsButton />
                    </HStack>
                </Box>
            </SimpleGrid>
        </Box>
    );
});
