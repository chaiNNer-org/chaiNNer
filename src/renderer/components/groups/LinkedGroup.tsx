import { memo } from 'react';
import { GroupProps } from './props';

interface Options {
    label: string;
}

const LinkedGroup = memo(
    ({ group, inputs, state: collapsed = false }: GroupProps<Options, boolean>) => {
        const { label = 'All' } = group.options;

        return <>foo</>;
    }
);
