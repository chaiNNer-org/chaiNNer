import { Divider, HStack, Text } from '@chakra-ui/react';
import { memo } from 'react';

interface SubcategoryHeadingProps {
    subcategory: string;
    collapsed?: boolean;
}

function SubcategoryHeading({ subcategory, collapsed = false }: SubcategoryHeadingProps) {
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
                        // w="auto"
                        whiteSpace="nowrap"
                    >
                        {subcategory}
                    </Text>
                    <Divider orientation="horizontal" />
                </>
            )}
        </HStack>
    );
}

export default memo(SubcategoryHeading);
