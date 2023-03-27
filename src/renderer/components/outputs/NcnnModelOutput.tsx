import { memo, useMemo } from 'react';
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

export const NcnnModelOutput = memo(({ outputId, useOutputData, animated }: OutputProps) => {
    const { current } = useOutputData<NcnnModelData>(outputId);

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
});
