import { Highlight } from '@chakra-ui/react';
import { Fragment, PropsWithChildren, memo } from 'react';

interface HighlighterProps {
    searchTerms: readonly string[];
}

const recursivelyMarkChildren = (
    children: React.ReactNode | string[],
    searchTerms: readonly string[]
): React.ReactNode | string[] => {
    if (Array.isArray(children)) {
        return children.map((child, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Fragment key={i}>{recursivelyMarkChildren(child, searchTerms)}</Fragment>
        ));
    }

    if (typeof children === 'string') {
        return (
            <Highlight
                query={[...searchTerms]}
                styles={{
                    backgroundColor: 'yellow.300',
                }}
            >
                {children}
            </Highlight>
        );
    }

    return children;
};

export const Highlighter = memo(
    ({ children, searchTerms }: PropsWithChildren<HighlighterProps>) => {
        return <>{recursivelyMarkChildren(children, searchTerms)}</>;
    }
);
