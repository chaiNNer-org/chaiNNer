/* eslint-disable no-nested-ternary */
import { ViewOffIcon, WarningIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Image, Spinner, Text } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContext, useContextSelector } from 'use-context-selector';
import { Size } from '../../../common/common-types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { useDevicePixelRatio } from '../../hooks/useDevicePixelRatio';
import { useMemoArray } from '../../hooks/useMemo';
import { DragHandleSVG } from '../CustomIcons';
import { OutputProps } from './props';

const IMAGE_PREVIEW_SIZE = 216;

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

export const LargeImageOutput = memo(
    ({ output, useOutputData, animated, size, setSize }: OutputProps) => {
        const { t } = useTranslation();

        const dpr = useDevicePixelRatio();
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);
        const realSize = (size?.width ?? IMAGE_PREVIEW_SIZE) * zoom * dpr;

        const { last, stale } = useOutputData<LargeImageBroadcastData>(output.id);

        const imgBgColor = 'var(--node-image-preview-bg)';
        const fontColor = 'var(--node-image-preview-color)';

        const previewImage = last ? pickImage(last.previews, realSize) : null;

        const { useSnapToGrid } = useContext(SettingsContext);
        const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

        const [resizeRef, setResizeRef] = useState<Resizable | null>(null);

        const [maxSize, setMaxSize] = useState<Size>({
            width: IMAGE_PREVIEW_SIZE,
            height: IMAGE_PREVIEW_SIZE,
        });

        useEffect(() => {
            if (last?.previews) {
                const biggestImage = last.previews[last.previews.length - 1];
                const img = new window.Image();
                img.src = biggestImage.url;
                img.onload = () => {
                    setMaxSize({
                        width: img.width,
                        height: img.height,
                    });
                    resizeRef?.updateSize({
                        width: Math.min(img.width, size?.width ?? IMAGE_PREVIEW_SIZE),
                        height: Math.min(img.height, size?.height ?? IMAGE_PREVIEW_SIZE),
                    });
                    setSize({
                        width: Math.min(img.width, size?.width ?? IMAGE_PREVIEW_SIZE),
                        height: Math.min(img.height, size?.height ?? IMAGE_PREVIEW_SIZE),
                    });
                };
            } else {
                setMaxSize({
                    width: IMAGE_PREVIEW_SIZE,
                    height: IMAGE_PREVIEW_SIZE,
                });
                resizeRef?.updateSize({
                    width: IMAGE_PREVIEW_SIZE,
                    height: IMAGE_PREVIEW_SIZE,
                });
                setSize({
                    width: IMAGE_PREVIEW_SIZE,
                    height: IMAGE_PREVIEW_SIZE,
                });
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [previewImage, resizeRef]);

        const firstRender = useRef(false);
        useEffect(() => {
            if (!firstRender.current) {
                if (size) {
                    resizeRef?.updateSize({
                        width: size.width,
                        height: size.height,
                    });
                    firstRender.current = true;
                }
            }
        }, [resizeRef, size]);

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
                    defaultSize={{
                        width: size?.width ?? IMAGE_PREVIEW_SIZE,
                        height: size?.height ?? IMAGE_PREVIEW_SIZE,
                    }}
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
                    // lockAspectRatio={maxSize.width / maxSize.height}
                    maxHeight={maxSize.height}
                    maxWidth={maxSize.width}
                    minHeight={IMAGE_PREVIEW_SIZE}
                    minWidth={IMAGE_PREVIEW_SIZE}
                    ref={(r) => {
                        setResizeRef(r);
                    }}
                    scale={zoom}
                    onResizeStop={(e, direction, ref, d) => {
                        let baseWidth = size?.width ?? IMAGE_PREVIEW_SIZE;
                        let baseHeight = size?.height ?? IMAGE_PREVIEW_SIZE;

                        if (baseWidth < IMAGE_PREVIEW_SIZE) baseWidth = IMAGE_PREVIEW_SIZE;
                        if (baseHeight < IMAGE_PREVIEW_SIZE) baseHeight = IMAGE_PREVIEW_SIZE;

                        const newSize = {
                            width: baseWidth + d.width,
                            height: baseHeight + d.height,
                        };
                        setSize(newSize);
                    }}
                >
                    <Center
                        h="full"
                        w="full"
                    >
                        <Box
                            display={stale ? 'block' : 'none'}
                            h="full"
                            marginRight={`-${IMAGE_PREVIEW_SIZE}px`}
                            w="full"
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
                            h="full"
                            maxH="full"
                            maxW="full"
                            minH={`${
                                animated ? size?.height ?? IMAGE_PREVIEW_SIZE : IMAGE_PREVIEW_SIZE
                            }px`}
                            minW={`${
                                animated ? size?.width ?? IMAGE_PREVIEW_SIZE : IMAGE_PREVIEW_SIZE
                            }px`}
                            overflow="hidden"
                            w="full"
                        >
                            {last && previewImage ? (
                                <Center
                                    h="full"
                                    maxH="full"
                                    maxW="full"
                                    w="full"
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
                                        h={maxSize.height < IMAGE_PREVIEW_SIZE ? 'auto' : 'full'}
                                        maxH="full"
                                        maxW="full"
                                        objectFit="contain"
                                        src={previewImage.url}
                                        sx={{
                                            imageRendering:
                                                zoom > 1 &&
                                                realSize > IMAGE_PREVIEW_SIZE &&
                                                previewImage.size < realSize
                                                    ? 'pixelated'
                                                    : 'auto',
                                        }}
                                        w={maxSize.width < IMAGE_PREVIEW_SIZE ? 'auto' : 'full'}
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
    }
);
