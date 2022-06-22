/* eslint-disable react/no-unstable-nested-components */
import { Center, Spinner, Tag, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useContext } from 'use-context-selector';
import { getBackend } from '../../../../common/Backend';
import { checkFileExists, visitByType } from '../../../../common/util';
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

type State =
    | { readonly type: 'clear' }
    | { readonly type: 'loading' }
    | { readonly type: 'error'; message: string }
    | { readonly type: 'model'; model: ModelData };
const CLEAR_STATE: State = { type: 'clear' };
const LOADING_STATE: State = { type: 'loading' };

const TorchModelPreview = memo(({ path, schemaId, id }: TorchModelPreviewProps) => {
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

                const result = await backend.runIndividual<ModelData>({
                    schemaId,
                    id,
                    inputs: [path],
                    isCpu,
                    isFp16,
                });

                if (!result.success) {
                    return {
                        type: 'error',
                        message: 'Failed to load model. Model type is likely unsupported.',
                    };
                }

                return { type: 'model', model: result.data };
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
                model: ({ model }) => (
                    <Wrap
                        justify="center"
                        maxW={60}
                        spacing={2}
                    >
                        <WrapItem>
                            <Tag>{model.modelType ?? '?'}</Tag>
                        </WrapItem>
                        <WrapItem>
                            <Tag>{model.scale}x</Tag>
                        </WrapItem>
                        <WrapItem>
                            <Tag>
                                {getColorMode(model.inNc)}→{getColorMode(model.outNc)}
                            </Tag>
                        </WrapItem>
                        {model.size.map((size) => (
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
                ),
                error: ({ message }) => <Text w="200px">{message}</Text>,
            })}
        </Center>
    );
});

export default TorchModelPreview;
