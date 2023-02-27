import { literal } from '@chainner/navi';
import { memo, useEffect, useMemo } from 'react';
import { useContext } from 'use-context-selector';
import { struct } from '../../../common/types/util';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { ModelDataTags } from './elements/ModelDataTags';
import { OutputProps } from './props';

interface PyTorchModelData {
    arch: string;
    inNc: number;
    outNc: number;
    size: string[];
    scale: number;
    subType: string;
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

export const PyTorchOutput = memo(
    ({ id, outputId, useOutputData, animated, schemaId }: OutputProps) => {
        const { current } = useOutputData<PyTorchModelData>(outputId);

        const { setManualOutputType } = useContext(GlobalContext);
        const { schemata } = useContext(BackendContext);

        const schema = schemata.get(schemaId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (current) {
                    setManualOutputType(
                        id,
                        outputId,
                        struct('PyTorchModel', {
                            scale: literal(current.scale),
                            inputChannels: literal(current.inNc),
                            outputChannels: literal(current.outNc),
                            arch: literal(current.arch),
                            size: literal(current.size.join('x')),
                            subType: literal(current.subType),
                        })
                    );
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, current, outputId, schema, setManualOutputType]);

        const tags = useMemo(() => {
            if (!current) return undefined;

            return [
                current.arch,
                `${getColorMode(current.inNc)}→${getColorMode(current.outNc)}`,
                ...current.size,
            ];
        }, [current]);

        return (
            <ModelDataTags
                loading={animated}
                tags={tags}
            />
        );
    }
);
