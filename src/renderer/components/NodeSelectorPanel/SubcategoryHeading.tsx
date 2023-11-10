import { Divider, HStack, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { NodeGroup } from '../../../common/common-types';

interface SubcategoryHeadingProps {
    group: NodeGroup;
    collapsed?: boolean;
}

export const SubcategoryHeading = memo(({ group, collapsed = false }: SubcategoryHeadingProps) => {
    return (
        <HStack
            h={6}
            w="full"
        >
            {collapsed ? (
                <Divider orientation="horizontal" />
            ) : (
                <>
                    <Divider orientation="horizontal" />
                    <Text
                        casing="uppercase"
                        color="#71809699"
                        fontSize="sm"
                        py={0.5}
                        whiteSpace="nowrap"
                    >
                        {group.name}
                    </Text>
                    <Divider orientation="horizontal" />
                </>
            )}
        </HStack>
    );
});
