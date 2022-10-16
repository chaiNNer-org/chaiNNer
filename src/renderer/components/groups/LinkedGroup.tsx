import { memo } from 'react';
import { GroupProps } from './props';

interface Options {
    label: string;
}

const LinkedGroup = memo(({ id, options, inputs }: GroupProps<Options>) => {
    const { label = 'All' } = options;

    return <>foo</>;
});
