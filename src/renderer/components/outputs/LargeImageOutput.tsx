/* eslint-disable no-nested-ternary */
import { NamedExpression, NamedExpressionField, literal } from '@chainner/navi';
import { ViewOffIcon, WarningIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Image, Spinner, Text } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { OutputProps } from './props';

const IMAGE_PREVIEW_SIZE = 200;

interface PreviewImage {
    size: number;
    url: string;
}
interface LargeImageBroadcastData {
    previews: PreviewImage[];
    width: number;
    height: number;
    channels: number;
}

const pickImage = (last: LargeImageBroadcastData, realSize: number) => {
    const found = last.previews.find((preview) => {
        return preview.size >= realSize;
    });
    return found ?? last.previews[last.previews.length - 1];
};

export const LargeImageOutput = memo(
    ({ id, outputId, useOutputData, animated, schemaId }: OutputProps) => {
        const { setManualOutputType } = useContext(GlobalContext);
        const { schemata } = useContext(BackendContext);
        const schema = schemata.get(schemaId);

        const dpr = useDevicePixelRatio();
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);
        const realSize = IMAGE_PREVIEW_SIZE * zoom * dpr;

        const { current, last, stale } = useOutputData<LargeImageBroadcastData>(outputId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (current) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('Image', [
                            new NamedExpressionField('width', literal(current.width)),
                            new NamedExpressionField('height', literal(current.height)),
                            new NamedExpressionField('channels', literal(current.channels)),
                        ])
                    );
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, current, outputId, schema, setManualOutputType]);

        const imgBgColor = 'var(--node-image-preview-bg)';
        const fontColor = 'var(--node-image-preview-color)';

        const pickedImage = last ? pickImage(last, realSize) : null;

        return (
            <Center
                h="full"
                minH="2rem"
                overflow="hidden"
                verticalAlign="middle"
                w="full"
            >
                <Center
                    h={`${IMAGE_PREVIEW_SIZE}px`}
                    // overflow="hidden"
                    w={`${IMAGE_PREVIEW_SIZE}px`}
                >
                    <Box
                        display={stale ? 'block' : 'none'}
                        h={`${IMAGE_PREVIEW_SIZE}px`}
                        marginRight={`-${IMAGE_PREVIEW_SIZE}px`}
                        w={`${IMAGE_PREVIEW_SIZE}px`}
                        zIndex="99"
                    >
                        <HStack
                            alignContent="center"
                            alignItems="center"
                            bgColor={imgBgColor}
                            borderRadius="md"
                            margin={2}
                            opacity={0.75}
                            px={2}
                            py={1}
                            spacing={1}
                            verticalAlign="middle"
                            w="auto"
                            zIndex="99"
                        >
                            <WarningIcon
                                boxSize={3}
                                color={fontColor}
                            />
                            <Text
                                color={fontColor}
                                fontSize="sm"
                                fontWeight={500}
                            >
                                Outdated
                            </Text>
                        </HStack>
                    </Box>
                    <Center
                        bgColor={imgBgColor}
                        borderRadius="md"
                        h={`${IMAGE_PREVIEW_SIZE}px`}
                        maxH={`${IMAGE_PREVIEW_SIZE}px`}
                        maxW={`${IMAGE_PREVIEW_SIZE}px`}
                        minH={`${IMAGE_PREVIEW_SIZE}px`}
                        minW={`${IMAGE_PREVIEW_SIZE}px`}
                        overflow="hidden"
                        w={`${IMAGE_PREVIEW_SIZE}px`}
                    >
                        {last && pickedImage ? (
                            <Center
                                maxH={`${IMAGE_PREVIEW_SIZE}px`}
                                maxW={`${IMAGE_PREVIEW_SIZE}px`}
                            >
                                <Image
                                    alt="Image preview failed to load, probably unsupported file type."
                                    backgroundImage={
                                        last.channels === 4
                                            ? 'data:image/webp;base64,UklGRigAAABXRUJQVlA4IBwAAAAwAQCdASoQABAACMCWJaQAA3AA/u11j//aQAAA'
                                            : ''
                                    }
                                    draggable={false}
                                    maxH={`${IMAGE_PREVIEW_SIZE}px`}
                                    maxW={`${IMAGE_PREVIEW_SIZE}px`}
                                    src={pickedImage.url}
                                    sx={{
                                        imageRendering:
                                            zoom > 1 &&
                                            realSize > IMAGE_PREVIEW_SIZE &&
                                            pickedImage.size < realSize
                                                ? 'pixelated'
                                                : 'auto',
                                    }}
                                />
                            </Center>
                        ) : animated ? (
                            <Spinner />
                        ) : (
                            <HStack>
                                <ViewOffIcon />
                                <Text
                                    fontSize="sm"
                                    lineHeight="0.5rem"
                                >
                                    Image not available.
                                </Text>
                            </HStack>
                        )}
                    </Center>
                </Center>
            </Center>
        );
    }
);
