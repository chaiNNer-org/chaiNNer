/* eslint-disable no-nested-ternary */
import { ViewOffIcon, WarningIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Image, Spinner, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { useDevicePixelRatio } from '../../hooks/useDevicePixelRatio';
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

const pickImage = (previews: PreviewImage[], realSize: number) => {
    const found = previews
        .sort((a, b) => a.size - b.size)
        .find((preview) => {
            return preview.size >= realSize;
        });
    return found ?? previews[previews.length - 1];
};

export const LargeImageOutput = memo(({ output, useOutputData, animated }: OutputProps) => {
    const { t } = useTranslation();

    const dpr = useDevicePixelRatio();
    const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);
    const realSize = IMAGE_PREVIEW_SIZE * zoom * dpr;

    const { last, stale } = useOutputData<LargeImageBroadcastData>(output.id);

    const imgBgColor = 'var(--node-image-preview-bg)';
    const fontColor = 'var(--node-image-preview-color)';

    const pickedImage = last ? pickImage(last.previews, realSize) : null;

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
                                background={
                                    last.channels === 4
                                        ? // https://stackoverflow.com/a/65129916/7595472
                                          'repeating-conic-gradient(#CDCDCD 0% 25%, #FFFFFF 0% 50%) 50% / 20px 20px'
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
                                {t('outputs.largeImage.imageNotAvailable', 'Image not available.')}
                            </Text>
                        </HStack>
                    )}
                </Center>
            </Center>
        </Center>
    );
});
