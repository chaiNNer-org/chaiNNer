import { Box, HStack, Heading, Image, Tag } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { ipcRenderer } from '../../../common/safeIpc';
import logo from '../../../public/icons/png/256x256.png';
import { useAsyncEffect } from '../../hooks/useAsyncEffect';

export const AppInfo = memo(() => {
    const [appVersion, setAppVersion] = useState('#.#.#');
    useAsyncEffect(
        () => ({
            supplier: () => ipcRenderer.invoke('get-app-version'),
            successEffect: setAppVersion,
        }),
        []
    );

    return (
        <Box w="full">
            <HStack
                ml={0}
                mr="auto"
            >
                <Image
                    boxSize="36px"
                    draggable={false}
                    src={logo}
                />
                <Heading size="md">chaiNNer</Heading>
                <Tag>Alpha</Tag>
                <Tag>{`v${appVersion}`}</Tag>
            </HStack>
        </Box>
    );
});
