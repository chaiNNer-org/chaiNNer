import { Center, HStack, Image, Spinner, Tag, VStack } from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { useContext } from 'use-context-selector';
import { getBackend } from '../../../../common/Backend';
import { NamedExpression, NamedExpressionField } from '../../../../common/types/expression';
import { NumericLiteralType, StringLiteralType } from '../../../../common/types/types';
import { checkFileExists } from '../../../../common/util';
import { GlobalContext } from '../../../contexts/GlobalNodeState';
import { SettingsContext } from '../../../contexts/SettingsContext';
import { useAsyncEffect } from '../../../hooks/useAsyncEffect';

interface ImageObject {
    image: string;
    width: number;
    height: number;
    channels: number;
    directory: string;
    name: string;
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

const ImagePreview = memo(({ path, schemaId, id }: ImagePreviewProps) => {
    const [img, setImg] = useState<ImageObject | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { setManualOutputType } = useContext(GlobalContext);
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

    useEffect(() => {
        if (schemaId === 'chainner:image:load') {
            if (img) {
                setManualOutputType(
                    id,
                    0,
                    new NamedExpression('Image', [
                        new NamedExpressionField('width', new NumericLiteralType(img.width)),
                        new NamedExpressionField('height', new NumericLiteralType(img.height)),
                        new NamedExpressionField('channels', new NumericLiteralType(img.channels)),
                    ])
                );
                setManualOutputType(
                    id,
                    1,
                    new NamedExpression('Directory', [
                        new NamedExpressionField('path', new StringLiteralType(img.directory)),
                    ])
                );
                setManualOutputType(id, 2, new StringLiteralType(img.name));
            } else {
                setManualOutputType(id, 0, undefined);
                setManualOutputType(id, 1, undefined);
                setManualOutputType(id, 2, undefined);
            }
        }
    }, [id, schemaId, img]);

    return (
        <Center w="full">
            {isLoading ? (
                <Spinner />
            ) : (
                <VStack>
                    <Center
                        h="200px"
                        w="200px"
                    >
                        <Image
                            alt={
                                img
                                    ? 'Image preview failed to load, probably unsupported file type.'
                                    : 'File does not exist on the system. Please select a different file.'
                            }
                            borderRadius="md"
                            draggable={false}
                            maxH="200px"
                            maxW="200px"
                            src={img?.image || path}
                        />
                    </Center>
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

export default ImagePreview;
