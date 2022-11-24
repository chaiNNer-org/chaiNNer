import { Box, Center, Heading, Text, VStack } from '@chakra-ui/react';
import React, { DragEvent, memo } from 'react';
import { migrate } from '../../../common/migrations';
import { deepCopy } from '../../../common/util';
import { TransferTypes } from '../../helpers/dataTransfer';
import { Preset } from './presets';

const onDragStart = (event: DragEvent<HTMLDivElement>, preset: Preset) => {
    const changedPreset = deepCopy({ ...preset });

    // Migrate preset to latest version
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    changedPreset.chain.content = migrate(
        changedPreset.chain.version,
        changedPreset.chain.content,
        changedPreset.chain.migration
    );

    const minX = Math.min(...changedPreset.chain.content.nodes.map((node) => node.position.x));
    const minY = Math.min(...changedPreset.chain.content.nodes.map((node) => node.position.y));

    // Subtract the minimum x and y values from all nodes
    // We don't need to use the mouse offset here, it feels kinda weird (doesn't scale with zoom)
    // const { offsetX, offsetY } = event.nativeEvent;
    changedPreset.chain.content.nodes = changedPreset.chain.content.nodes.map((node) =>
        node.parentNode
            ? node
            : {
                  ...node,
                  position: {
                      x: node.position.x - minX,
                      y: node.position.y - minY,
                  },
              }
    );

    event.dataTransfer.setData(TransferTypes.Preset, JSON.stringify(changedPreset.chain));
    // eslint-disable-next-line no-param-reassign
    event.dataTransfer.effectAllowed = 'move';
};

interface PresetProps {
    preset: Preset;
    collapsed: boolean;
}

export const PresetComponent = memo(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ preset, collapsed }: React.PropsWithChildren<PresetProps>) => {
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
