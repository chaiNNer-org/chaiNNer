import { Box, Center, Heading, Text, VStack } from '@chakra-ui/react';
import React, { DragEvent, memo } from 'react';
import { TransferTypes } from '../../helpers/dataTransfer';
import { Preset } from './presets';

const onDragStart = (event: DragEvent<HTMLDivElement>, preset: Preset) => {
    const { offsetX, offsetY } = event.nativeEvent;
    const changedPreset = { ...preset };
    // Get the minimum x and y values
    const minX = Math.min(...changedPreset.chain.content.nodes.map((node) => node.position.x));
    const minY = Math.min(...changedPreset.chain.content.nodes.map((node) => node.position.y));

    // Subtract the minimum x and y values from all nodes, add mouse offset
    // This will place the nodes relative to the mouse, but also relative to each other correctly
    changedPreset.chain.content.nodes.forEach((node) => {
        // eslint-disable-next-line no-param-reassign
        node.position.x -= minX + offsetX;
        // eslint-disable-next-line no-param-reassign
        node.position.y -= minY + offsetY;
    });

    event.dataTransfer.setData(TransferTypes.Preset, JSON.stringify(changedPreset));
    // eslint-disable-next-line no-param-reassign
    event.dataTransfer.effectAllowed = 'move';
};

interface PresetProps {
    preset: Preset;
    collapsed: boolean;
}

export const PresetComponent = memo(
    ({ children, preset, collapsed }: React.PropsWithChildren<PresetProps>) => {
        return (
            <Box
                key={preset.name}
                p={2}
                width={300}
            >
                <Center
                    draggable
                    _active={{ borderColor: 'white' }}
                    _focus={{ borderColor: 'white' }}
                    _hover={{ borderColor: 'white' }}
                    borderColor="var(--selector-node-bg)"
                    borderRadius="lg"
                    borderWidth="1px"
                    boxShadow="lg"
                    overflow="hidden"
                    tabIndex={0}
                    transition="border 0.15s ease-in-out"
                    w="full"
                    onDragStart={(event) => {
                        onDragStart(event, preset);
                    }}
                >
                    <VStack
                        p={2}
                        w="full"
                    >
                        <Heading
                            as="h4"
                            size="md"
                            w="full"
                        >
                            {preset.name}
                        </Heading>
                        <Text
                            as="i"
                            fontSize="sm"
                            w="full"
                        >
                            By: {preset.author}
                        </Text>
                        <Text
                            fontSize="md"
                            w="full"
                        >
                            {preset.description}
                        </Text>
                    </VStack>
                </Center>
            </Box>
        );
    }
);
