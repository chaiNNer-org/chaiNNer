import { Text, useColorModeValue } from '@chakra-ui/react';
import React, { ReactNode, memo, useMemo } from 'react';
import { createContext, useContext } from 'use-context-selector';
import { useMemoObject } from '../../hooks/useMemo';

// eslint-disable-next-line react-memo/require-memo
export const NoHighlighting = ({ children }: React.PropsWithChildren<unknown>) => {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
};

const HighlightedText = memo(({ text, regex }: { text: string; regex: RegExp }) => {
    const parts = text.split(regex);

    const bgColor = useColorModeValue('yellow.300', 'yellow.700');

    const highlightedParts = parts.map((part, index) =>
        index % 2 === 1 ? (
            <Text
                as="span"
                backgroundColor={bgColor}
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                userSelect="text"
            >
                {part}
            </Text>
        ) : (
            part
        )
    );

    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{highlightedParts}</>;
});

const recursiveHighlight = (children: ReactNode, regex: RegExp): ReactNode => {
    const result = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
            return (
                <HighlightedText
                    key={child}
                    regex={regex}
                    text={child}
                />
            );
        }

        if (React.isValidElement(child)) {
            if (child.type === NoHighlighting) {
                return child;
            }

            const props = child.props as unknown;
            if (props && typeof props === 'object' && 'children' in props) {
                const highlightedChildren = recursiveHighlight(props.children as ReactNode, regex);
                return React.cloneElement(child, { children: highlightedChildren } as never);
            }
        }

        return child;
    });
    if (Array.isArray(result) && result.length === 1) {
        return result[0];
    }
    return result;
};

interface HighlightContextState {
    regex?: RegExp;
}
const HighlightContext = createContext<HighlightContextState>({});

export const SupportHighlighting = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { regex } = useContext(HighlightContext);

    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{regex ? recursiveHighlight(children, regex) : children}</>;
});

interface HighlightContainerProps {
    search: RegExp | undefined;
}
export const HighlightContainer = memo(
    ({ children, search }: React.PropsWithChildren<HighlightContainerProps>) => {
        const regex = useMemo(() => search && new RegExp(`(${search.source})`, 'gi'), [search]);
        const value = useMemoObject<HighlightContextState>({ regex });

        return (
            <HighlightContext.Provider value={value}>
                <SupportHighlighting>{children}</SupportHighlighting>
            </HighlightContext.Provider>
        );
    }
);
