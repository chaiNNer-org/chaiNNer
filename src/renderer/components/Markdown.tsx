import { Code, Link, Text } from '@chakra-ui/react';
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import { memo } from 'react';
import { Components } from 'react-markdown';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { BackendContext } from '../contexts/BackendContext';
import { SupportHighlighting } from './NodeDocumentation/HighlightContainer';
import { SchemaLink } from './NodeDocumentation/SchemaLink';

const getDocsMarkdownComponents = (interactive: boolean, selectable: boolean): Components => {
    return {
        p: ({ children }) => {
            return (
                <SupportHighlighting>
                    <Text
                        my={2}
                        userSelect={selectable ? 'text' : 'none'}
                    >
                        {children}
                    </Text>
                </SupportHighlighting>
            );
        },
        a: ({ children, href }) => {
            return (
                <Link
                    isExternal
                    href={href}
                    textColor={interactive && href ? 'var(--link-color)' : 'inherit'}
                    textDecoration={interactive && href ? 'underline' : 'inherit'}
                    userSelect={selectable ? 'text' : 'none'}
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
                    userSelect={selectable ? 'text' : 'none'}
                >
                    {children}
                </Code>
            );
        }),
    };
};
export interface MarkdownProps {
    children: string;
    nonInteractive?: boolean;
    selectable?: boolean;
}

export const Markdown = memo(
    ({ children, nonInteractive = false, selectable = true }: MarkdownProps) => {
        const components = ChakraUIRenderer(getDocsMarkdownComponents(!nonInteractive, selectable));

        return (
            <ReactMarkdown
                skipHtml
                className="no-child-margin"
                components={components}
            >
                {children}
            </ReactMarkdown>
        );
    }
);
