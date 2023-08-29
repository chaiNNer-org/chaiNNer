/* eslint-disable no-nested-ternary */
import { ViewOffIcon, WarningIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Image, Spinner, Text } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContext, useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { useDevicePixelRatio } from '../../hooks/useDevicePixelRatio';
import { useMemoArray } from '../../hooks/useMemo';
import { DragHandleSVG } from '../CustomIcons';
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

    const pickedImage = last ? last.previews[last.previews.length - 1] : null; // last ? pickImage(last.previews, realSize) : null;

    const { useSnapToGrid } = useContext(SettingsContext);
    const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

    const [resizeRef, setResizeRef] = useState<Resizable | null>(null);

    return (
        <Center
            h="full"
            minH="2rem"
            overflow="hidden"
            verticalAlign="middle"
            w="full"
        >
            <Resizable
                className="nodrag"
                // defaultSize={iteratorSize ?? defaultIteratorSize}
                enable={{
                    top: false,
                    right: true,
                    bottom: true,
                    left: false,
                    topRight: false,
                    bottomRight: true,
                    bottomLeft: false,
                    topLeft: false,
                }}
                grid={useMemoArray<[number, number]>(
                    isSnapToGrid ? [snapToGridAmount, snapToGridAmount] : [1, 1]
                )}
                handleComponent={{
                    bottomRight: (
                        <Center
                            cursor="nwse-resize"
                            h="full"
                            ml={-1}
                            mt={-1}
                            w="full"
                        >
                            <DragHandleSVG
                                color="var(--fg-300)"
                                opacity={0.75}
                            />
                        </Center>
                    ),
                }}
                minHeight={IMAGE_PREVIEW_SIZE}
                minWidth={IMAGE_PREVIEW_SIZE}
                ref={(r) => {
                    setResizeRef(r);
                }}
                scale={zoom}
                style={{
                    margin: 8,
                    marginBottom: 0,
                    marginTop: 0,
                }}
                // onResizeStop={(e, direction, ref, d) => {
                //     const size = {
                //         offsetTop: ref.offsetTop,
                //         offsetLeft: ref.offsetLeft,
                //         width: (width < minWidth ? minWidth : width) + d.width,
                //         height: (height < minHeight ? minHeight : height) + d.height,
                //     };
                //     setIteratorSize(id, size);
                //     updateIteratorBounds(id, size);
                // }}
            >
                <Center
                    // h={`${IMAGE_PREVIEW_SIZE}px`}
                    // overflow="hidden"
                    // w={`${IMAGE_PREVIEW_SIZE}px`}
                    h="full"
                    w="full"
                >
                    <Box
                        zIndex="99"
                        display={stale ? 'block' : 'none'}
                        // h={`${IMAGE_PREVIEW_SIZE}px`}
                        marginRight={`-${IMAGE_PREVIEW_SIZE}px`}
                        h="full"
                        // w={`${IMAGE_PREVIEW_SIZE}px`}
                        w="full"
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
                        // h={`${IMAGE_PREVIEW_SIZE}px`}
                        // maxH={`${IMAGE_PREVIEW_SIZE}px`}
                        // maxW={`${IMAGE_PREVIEW_SIZE}px`}
                        // minH={`${IMAGE_PREVIEW_SIZE}px`}
                        // minW={`${IMAGE_PREVIEW_SIZE}px`}
                        w="full"
                        overflow="hidden"
                        // w={`${IMAGE_PREVIEW_SIZE}px`}
                        h="full"
                    >
                        {last && pickedImage ? (
                            <Center
                            // maxH={`${IMAGE_PREVIEW_SIZE}px`}
                            // maxW={`${IMAGE_PREVIEW_SIZE}px`}
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
                                    // maxH={`${IMAGE_PREVIEW_SIZE}px`}
                                    // maxW={`${IMAGE_PREVIEW_SIZE}px`}
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
                                    {t(
                                        'outputs.largeImage.imageNotAvailable',
                                        'Image not available.'
                                    )}
                                </Text>
                            </HStack>
                        )}
                    </Center>
                </Center>
            </Resizable>
        </Center>
    );
});
