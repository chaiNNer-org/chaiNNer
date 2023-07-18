import { Code, Highlight, Link, Text } from '@chakra-ui/react';
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import { Fragment, PropsWithChildren, memo } from 'react';
import { Components } from 'react-markdown';
import { useContext } from 'use-context-selector';
import { SchemaId } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { SchemaLink } from './SchemaLink';

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

const getDocsMarkdownComponents = (interactive: boolean): Components => {
    return {
        p: memo(({ children }: PropsWithChildren<unknown>) => {
            const { nodeDocsSearchState } = useContext(NodeDocumentationContext);
            const { searchTerms } = nodeDocsSearchState;

            return (
                <Text
                    fontSize="md"
                    marginTop={1}
                    userSelect="text"
                >
                    {recursivelyMarkChildren(children, searchTerms)}
                </Text>
            );
        }),
        a: ({ children, href }) => {
            return (
                <Link
                    isExternal
                    href={href}
                    textColor={interactive && href ? 'blue.500' : 'inherit'}
                    textDecoration={interactive && href ? 'underline' : 'inherit'}
                >
                    {children}
                </Link>
            );
        },
        // eslint-disable-next-line react/prop-types
        code: memo(({ inline, className, children, ...props }) => {
            const { schemata } = useContext(BackendContext);

            // const language = /language-([\w-]+)/.exec(className || '')?.[1];
            const text = String(children);

            if (inline && schemata.has(text as SchemaId)) {
                const schema = schemata.get(text as SchemaId);
                if (!interactive) {
                    return <Text as="i">{schema.name}</Text>;
                }
                return <SchemaLink schema={schema} />;
            }

            return (
                <Code
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...props}
                    className={className}
                >
                    {children}
                </Code>
            );
        }),
    };
};

export const docsMarkdown = ChakraUIRenderer(getDocsMarkdownComponents(true));
export const tooltipDocsMarkdown = ChakraUIRenderer(getDocsMarkdownComponents(false));
