import { memo } from 'react';
import { ModelDataTags } from './elements/ModelDataTags';
import { OutputProps } from './props';

interface TagData {
    tags?: readonly string[] | null;
}

export const TaggedOutput = memo(({ output, useOutputData, animated }: OutputProps) => {
    const { current } = useOutputData<TagData>(output.id);

    return (
        <ModelDataTags
            loading={animated}
            tags={current?.tags || undefined}
        />
    );
});
