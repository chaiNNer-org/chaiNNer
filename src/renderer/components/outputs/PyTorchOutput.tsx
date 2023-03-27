import { memo, useMemo } from 'react';
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

export const PyTorchOutput = memo(({ outputId, useOutputData, animated }: OutputProps) => {
    const { current } = useOutputData<PyTorchModelData>(outputId);

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
});
