import { Center, Flex, Image, Spacer, Text, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { OutputId } from '../../../common/common-types';
import { Type } from '../../../common/types/types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTag } from '../TypeTag';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: OutputId;
    definitionType: Type;
    useOutputData: (outputId: OutputId) => unknown;
}

interface SmallImageBroadcastData {
    image: string;
    width: number;
    height: number;
    channels: number;
}

export const SmallImageOutput = memo(
    ({ label, id, outputId, definitionType, useOutputData }: GenericOutputProps) => {
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );

        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

        const value = useOutputData(outputId) as SmallImageBroadcastData | undefined;

        const imgBgColor = useColorModeValue('gray.400', 'gray.750');

        return (
            <Flex
                h="full"
                minH="2rem"
                verticalAlign="middle"
                w="full"
            >
                {value && (
                    <Center
                        h="2rem"
                        w="2rem"
                    >
                        <Center
                            bgColor={imgBgColor}
                            borderRadius="md"
                            h="1.75rem"
                            maxH="1.75rem"
                            maxW="1.75rem"
                            minH="1.75rem"
                            minW="1.75rem"
                            overflow="hidden"
                            w="1.75rem"
                        >
                            <Image
                                alt="Image preview failed to load, probably unsupported file type."
                                backgroundImage={
                                    value.channels === 4
                                        ? 'data:image/webp;base64,UklGRigAAABXRUJQVlA4IBwAAAAwAQCdASoQABAACMCWJaQAA3AA/u11j//aQAAA'
                                        : ''
                                }
                                draggable={false}
                                maxH="1.75rem"
                                maxW="1.75rem"
                                src={value.image}
                                sx={{
                                    imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                                }}
                            />
                        </Center>
                    </Center>
                )}
                <Spacer />
                {type && (
                    <Center
                        h="2rem"
                        verticalAlign="middle"
                    >
                        <TypeTag type={type} />
                    </Center>
                )}
                <Text
                    h="full"
                    lineHeight="2rem"
                    marginInlineEnd="0.5rem"
                    ml={1}
                    textAlign="right"
                >
                    {label}
                </Text>
            </Flex>
        );
    }
);
