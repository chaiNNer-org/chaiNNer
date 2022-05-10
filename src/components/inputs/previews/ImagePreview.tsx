import { Center, HStack, Image, Spinner, Tag, VStack } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useContext } from 'use-context-selector';
import { getBackend } from '../../../helpers/Backend';
import { SettingsContext } from '../../../helpers/contexts/SettingsContext';
import { useAsyncEffect } from '../../../helpers/hooks/useAsyncEffect';
import { checkFileExists } from '../../../helpers/util';

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

export default memo(({ path, schemaId, id }: ImagePreviewProps) => {
    const [img, setImg] = useState<ImageObject | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);
    const backend = getBackend(port);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    useAsyncEffect(
        {
            supplier: async (token) => {
                token.causeEffect(() => setIsLoading(true));

                if (path) {
                    const fileExists = await checkFileExists(path);
                    if (fileExists) {
                        return backend.runIndividual<ImageObject | null>({
                            schemaId,
                            id,
                            inputs: [path],
                            isCpu,
                            isFp16,
                        });
                    }
                }
                return null;
            },
            successEffect: setImg,
            finallyEffect: () => setIsLoading(false),
        },
        [path]
    );

    return (
        <Center w="full">
            {isLoading ? (
                <Spinner />
            ) : (
                <VStack>
                    <Image
                        alt={
                            img
                                ? 'Image preview failed to load, probably unsupported file type.'
                                : 'File does not exist on the system. Please select a different file.'
                        }
                        // boxSize="150px"
                        borderRadius="md"
                        draggable={false}
                        maxH="200px"
                        // fallbackSrc="https://via.placeholder.com/200"
                        maxW="200px"
                        src={img?.image || path}
                    />
                    {img && path && (
                        <HStack>
                            <Tag>
                                {img.width}x{img.height}
                            </Tag>
                            <Tag>{getColorMode(img)}</Tag>
                            <Tag>{String(path.split('.').slice(-1)).toUpperCase()}</Tag>
                        </HStack>
                    )}
                </VStack>
            )}
        </Center>
    );
});
