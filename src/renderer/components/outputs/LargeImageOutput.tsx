/* eslint-disable no-nested-ternary */
import { ViewOffIcon, WarningIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Image, Spinner, Text } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { CSSProperties, memo, useEffect, useMemo, useRef, useState } from 'react';
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
const DEFAULT_SIZE: Readonly<Size> = {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
};

interface PreviewImage {
    readonly width: number;
    readonly height: number;
    readonly url: string;
}
interface LargeImageBroadcastData {
    readonly previews: readonly PreviewImage[];
    readonly width: number;
    readonly height: number;
    readonly channels: number;
}

const pickImage = (previews: readonly PreviewImage[], realWidth: number): PreviewImage => {
    const sorted = [...previews].sort((a, b) => a.width - b.width);
    const found = sorted.find((preview) => preview.width >= realWidth);
    return found ?? sorted[sorted.length - 1];
};

export const LargeImageOutput = memo(
    ({ output, useOutputData, animated, size = DEFAULT_SIZE, setSize }: OutputProps) => {
        const { t } = useTranslation();

        const [currentSize, setCurrentSize] = useState<Size>();

        const dpr = useDevicePixelRatio();
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);
        const realWidth = (currentSize ?? size).width * zoom * dpr;

        const { last, stale } = useOutputData<LargeImageBroadcastData>(output.id);

        const imgBgColor = 'var(--node-image-preview-bg)';
        const fontColor = 'var(--node-image-preview-color)';

        const previewImage = last ? pickImage(last.previews, realWidth) : null;

        const { useSnapToGrid } = useContext(SettingsContext);
        const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

        const [resizeRef, setResizeRef] = useState<Resizable | null>(null);

        const firstRender = useRef(false);
        useEffect(() => {
            if (!firstRender.current) {
                resizeRef?.updateSize({
                    width: size.width,
                    height: size.height,
                });
                firstRender.current = true;
            }
        }, [resizeRef, size]);

        const imageStyle = useMemo((): CSSProperties | undefined => {
            if (!last) return undefined;
            const s = currentSize ?? size;
            const sizeRatio = s.width / s.height;
            const imageRatio = last.width / last.height;
            return {
                aspectRatio: `${last.width} / ${last.height}`,
                width: sizeRatio < imageRatio ? `min(${last.width}px, 100%)` : undefined,
                height: sizeRatio < imageRatio ? undefined : `min(${last.height}px, 100%)`,
            };
        }, [currentSize, size, last]);

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
                    defaultSize={size}
                    enable={{
                        top: false,
                        right: false,
                        bottom: false,
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
                                className="nodrag"
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
                    maxHeight={1024}
                    maxWidth={1024}
                    minHeight={IMAGE_PREVIEW_SIZE}
                    minWidth={IMAGE_PREVIEW_SIZE}
                    ref={(r) => {
                        setResizeRef(r);
                    }}
                    scale={zoom}
                    onResize={(e, direction, ref, d) => {
                        setCurrentSize({
                            width: size.width + d.width,
                            height: size.height + d.height,
                        });
                    }}
                    onResizeStop={(e, direction, ref, d) => {
                        let baseWidth = size.width;
                        let baseHeight = size.height;

                        if (baseWidth < IMAGE_PREVIEW_SIZE) baseWidth = IMAGE_PREVIEW_SIZE;
                        if (baseHeight < IMAGE_PREVIEW_SIZE) baseHeight = IMAGE_PREVIEW_SIZE;

                        setSize({
                            width: baseWidth + d.width,
                            height: baseHeight + d.height,
                        });
                        setCurrentSize(undefined);
                    }}
                >
                    <Center
                        h="full"
                        w="full"
                    >
                        <Box
                            display={stale ? 'block' : 'none'}
                            h="full"
                            pointerEvents="none"
                            position="absolute"
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
                                position="absolute"
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
                            minH={`${animated ? size.height : IMAGE_PREVIEW_SIZE}px`}
                            minW={`${animated ? size.width : IMAGE_PREVIEW_SIZE}px`}
                            overflow="hidden"
                            w="full"
                        >
                            {last && previewImage ? (
                                <Center
                                    display="flex"
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
                                        src={previewImage.url}
                                        style={imageStyle}
                                        sx={{
                                            imageRendering:
                                                zoom > 1 &&
                                                realWidth > IMAGE_PREVIEW_SIZE &&
                                                previewImage.width < realWidth
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
    }
);
