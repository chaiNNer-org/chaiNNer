import { Center, Spinner, Tag, Wrap, WrapItem } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useContext } from 'use-context-selector';
import { getBackend } from '../../../../common/Backend';
import { checkFileExists } from '../../../../common/util';
import { AlertBoxContext, AlertType } from '../../../contexts/AlertBoxContext';
import { SettingsContext } from '../../../contexts/SettingsContext';
import { useAsyncEffect } from '../../../hooks/useAsyncEffect';

interface ModelData {
    modelType?: string;
    scale: number;
    inNc: number;
    outNc: number;
    size: string[];
}

const getColorMode = (channels: number) => {
    switch (channels) {
        case 1:
            return 'GRAY';
        case 3:
            return 'RGB';
        case 4:
            return 'RGBA';
        default:
            return channels;
    }
};

interface TorchModelPreviewProps {
    path?: string;
    id: string;
    schemaId: string;
}

const TorchModelPreview = memo(({ path, schemaId, id }: TorchModelPreviewProps) => {
    const [modelData, setModelData] = useState<ModelData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);
    const backend = getBackend(port);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    const { sendAlert } = useContext(AlertBoxContext);

    useAsyncEffect(
        {
            supplier: async (token) => {
                token.causeEffect(() => setIsLoading(true));

                if (path) {
                    const fileExists = await checkFileExists(path);
                    if (fileExists) {
                        return backend.runIndividual<ModelData | null>({
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
            successEffect: (value) => {
                const data = value as ModelData;
                if (data.modelType) {
                    setModelData(data);
                } else {
                    sendAlert({
                        type: AlertType.ERROR,
                        message: 'Failed to load model',
                    });
                }
            },
            catchEffect: (error) => {
                sendAlert({
                    type: AlertType.ERROR,
                    title: 'Error',
                    message: JSON.stringify(error, undefined, 2),
                    copyToClipboard: true,
                });
            },
            finallyEffect: () => setIsLoading(false),
        },
        [path]
    );

    return (
        <Center w="full">
            {isLoading ? (
                <Spinner />
            ) : (
                modelData && (
                    <Wrap
                        justify="center"
                        maxW={60}
                        spacing={2}
                    >
                        <WrapItem>
                            <Tag>{modelData.modelType ?? '?'}</Tag>
                        </WrapItem>
                        <WrapItem>
                            <Tag>{modelData.scale}x</Tag>
                        </WrapItem>
                        <WrapItem>
                            <Tag>
                                {getColorMode(modelData.inNc)}→{getColorMode(modelData.outNc)}
                            </Tag>
                        </WrapItem>
                        {modelData.size.map((size) => (
                            <WrapItem key={size}>
                                <Tag
                                    key={size}
                                    textAlign="center"
                                >
                                    {size}
                                </Tag>
                            </WrapItem>
                        ))}
                    </Wrap>
                )
            )}
        </Center>
    );
});

export default TorchModelPreview;
