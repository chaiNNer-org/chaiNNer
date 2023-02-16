import { NamedExpression, NamedExpressionField, literal } from '@chainner/navi';
import { memo, useEffect, useMemo } from 'react';
import { useContext } from 'use-context-selector';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { ModelDataTags } from './elements/ModelDataTags';
import { OutputProps } from './props';

interface NcnnModelData {
    inNc: number;
    outNc: number;
    scale: number;
    nf: number;
    fp: string;
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

export const NcnnModelOutput = memo(
    ({ id, outputId, useOutputData, animated, schemaId }: OutputProps) => {
        const { current } = useOutputData<NcnnModelData>(outputId);

        const { setManualOutputType } = useContext(GlobalContext);
        const { schemata } = useContext(BackendContext);

        const schema = schemata.get(schemaId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (current) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('NcnnNetwork', [
                            new NamedExpressionField('scale', literal(current.scale)),
                            new NamedExpressionField('inputChannels', literal(current.inNc)),
                            new NamedExpressionField('outputChannels', literal(current.outNc)),
                            new NamedExpressionField('nf', literal(current.nf)),
                            new NamedExpressionField('fp', literal(current.fp)),
                        ])
                    );
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, current, outputId, schema, setManualOutputType]);

        const tags = useMemo(() => {
            if (!current) return undefined;

            return [
                `${getColorMode(current.inNc)}→${getColorMode(current.outNc)}`,
                `${current.nf}nf`,
                current.fp,
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
