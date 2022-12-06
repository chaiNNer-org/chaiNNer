/* eslint-disable no-nested-ternary */
import { NamedExpression, NamedExpressionField, literal } from '@chainner/navi';
import { ViewOffIcon, WarningIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Image, Spinner, Text } from '@chakra-ui/react';
import os from 'os';
import path from 'path';
import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useContext, useContextSelector } from 'use-context-selector';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { ImagePreviewContext } from '../../contexts/ImagePreviewContext';
import { useDevicePixelRatio } from '../../hooks/useDevicePixelRatio';
import { OutputProps } from './props';

const IMAGE_PREVIEW_SIZE = 200;

const TEMP_DIR = os.tmpdir();
const TEMP_PREVIEW_FILEPATH_START = 'chaiNNer-temp-preview-';
const TEMP_PREVIEW_FILEPATH_EXT = '.png';

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
    const found = last.previews
        .sort((a, b) => a.size - b.size)
        .find((preview) => {
            return preview.size >= realSize;
        });
    return found ?? last.previews[last.previews.length - 1];
};

export const LargeImageOutput = memo(
    ({ id, outputId, useOutputData, animated, schemaId }: OutputProps) => {
        const { t } = useTranslation();

        const { setManualOutputType } = useContext(GlobalContext);
        const { schemata } = useContext(BackendContext);
        const schema = schemata.get(schemaId);

        const { showImage } = useContext(ImagePreviewContext);

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

        const fullPreviewPath = path.join(
            TEMP_DIR,
            `${TEMP_PREVIEW_FILEPATH_START}${id}${TEMP_PREVIEW_FILEPATH_EXT}`
        );
        const onPreviewClick = useCallback(() => {
            if (last) {
                showImage('');
                showImage(fullPreviewPath);
            }
        }, [fullPreviewPath, last, showImage]);

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
                        _hover={{
                            cursor: last ? 'zoom-in' : 'default',
                            border: last ? '1px solid white' : 'none',
                        }}
                        bgColor={imgBgColor}
                        borderRadius="md"
                        h={`${IMAGE_PREVIEW_SIZE}px`}
                        maxH={`${IMAGE_PREVIEW_SIZE}px`}
                        maxW={`${IMAGE_PREVIEW_SIZE}px`}
                        minH={`${IMAGE_PREVIEW_SIZE}px`}
                        minW={`${IMAGE_PREVIEW_SIZE}px`}
                        overflow="hidden"
                        transition="border 0.1s ease-in-out"
                        w={`${IMAGE_PREVIEW_SIZE}px`}
                        onClick={onPreviewClick}
                    >
                        {last && pickedImage ? (
                            <Center
                                _hover={{
                                    cursor: 'zoom-in',
                                }}
                                maxH={`${IMAGE_PREVIEW_SIZE}px`}
                                maxW={`${IMAGE_PREVIEW_SIZE}px`}
                            >
                                <Image
                                    _hover={{
                                        cursor: 'zoom-in',
                                    }}
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
                                    {t(
                                        'outputs.largeImage.imageNotAvailable',
                                        'Image not available.'
                                    )}
                                </Text>
                            </HStack>
                        )}
                    </Center>
                </Center>
            </Center>
        );
    }
);
