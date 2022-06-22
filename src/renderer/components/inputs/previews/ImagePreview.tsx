/* eslint-disable react/no-unstable-nested-components */
import { Center, HStack, Image, Spinner, Tag, Text, VStack } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useContext } from 'use-context-selector';
import { getBackend } from '../../../../common/Backend';
import { checkFileExists, visitByType } from '../../../../common/util';
import { SettingsContext } from '../../../contexts/SettingsContext';
import { useAsyncEffect } from '../../../hooks/useAsyncEffect';

interface ImageObject {
    width: number;
    height: number;
    channels: number;
    image: string;
}

const getColorMode = (img: ImageObject) => {
    switch (img.channels) {
        case 1:
            return 'GRAY';
        case 3:
            return 'RGB';
        case 4:
            return 'RGBA';
        default:
            return '?';
    }
};

interface ImagePreviewProps {
    path?: string;
    id: string;
    schemaId: string;
}

type State =
    | { readonly type: 'clear' }
    | { readonly type: 'loading' }
    | { readonly type: 'error'; message: string }
    | { readonly type: 'image'; image: ImageObject; fileType: string };
const CLEAR_STATE: State = { type: 'clear' };
const LOADING_STATE: State = { type: 'loading' };

const ImagePreview = memo(({ path, schemaId, id }: ImagePreviewProps) => {
    const [state, setState] = useState<State>(CLEAR_STATE);

    const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);
    const backend = getBackend(port);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    useAsyncEffect(
        {
            supplier: async (token): Promise<State> => {
                if (!path) return CLEAR_STATE;

                token.causeEffect(() => setState(LOADING_STATE));

                if (!(await checkFileExists(path))) {
                    return {
                        type: 'error',
                        message:
                            'File does not exist on the system. Please select a different file.',
                    };
                }

                const result = await backend.runIndividual<ImageObject>({
                    schemaId,
                    id,
                    inputs: [path],
                    isCpu,
                    isFp16,
                });

                if (!result.success) {
                    return {
                        type: 'error',
                        message: 'Image failed to load, probably unsupported file type.',
                    };
                }

                const fileType = (/\.(\w+)$/.exec(path) ?? ['', 'unknown'])[1];
                return { type: 'image', image: result.data, fileType };
            },
            successEffect: setState,
            catchEffect: (error) => {
                setState({ type: 'error', message: String(error) });
            },
        },
        [path]
    );

    return (
        <Center w="full">
            {visitByType(state, {
                clear: () => null,
                loading: () => <Spinner />,
                image: ({ image, fileType }) => (
                    <VStack>
                        <Center
                            h="200px"
                            w="200px"
                        >
                            <Image
                                alt="Image preview failed to load, probably unsupported file type."
                                backgroundImage={
                                    image.channels === 4
                                        ? 'data:image/webp;base64,UklGRigAAABXRUJQVlA4IBwAAAAwAQCdASoQABAACMCWJaQAA3AA/u11j//aQAAA'
                                        : ''
                                }
                                borderRadius="md"
                                draggable={false}
                                maxH="200px"
                                maxW="200px"
                                src={image.image}
                            />
                        </Center>
                        <HStack>
                            <Tag>
                                {image.width}x{image.height}
                            </Tag>
                            <Tag>{getColorMode(image)}</Tag>
                            <Tag>{fileType.toUpperCase()}</Tag>
                        </HStack>
                    </VStack>
                ),
                error: ({ message }) => <Text w="200px">{message}</Text>,
            })}
        </Center>
    );
});

export default ImagePreview;
