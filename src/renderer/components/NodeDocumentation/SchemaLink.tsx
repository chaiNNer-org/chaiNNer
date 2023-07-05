import { Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useContext } from 'use-context-selector';
import { NodeSchema } from '../../../common/common-types';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';

export const SchemaLink = memo(({ schema }: { schema: NodeSchema }) => {
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);

    return (
        <Text
            _hover={{
                textDecoration: 'underline',
            }}
            as="i"
            backgroundColor="var(--bg-700)"
            borderRadius={4}
            color="var(--link-color)"
            cursor="pointer"
            fontWeight="bold"
            px={2}
            py={1}
            userSelect="text"
            whiteSpace="nowrap"
            onClick={() => openNodeDocumentation(schema.schemaId)}
        >
            {schema.name}
        </Text>
    );
});
