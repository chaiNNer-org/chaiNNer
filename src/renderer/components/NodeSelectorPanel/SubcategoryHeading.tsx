import { Divider, HStack, Text } from '@chakra-ui/react';
import { memo } from 'react';

interface SubcategoryHeadingProps {
    subcategory: string;
    collapsed?: boolean;
}

export const SubcategoryHeading = memo(
    ({ subcategory, collapsed = false }: SubcategoryHeadingProps) => {
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
                            {subcategory}
                        </Text>
                        <Divider orientation="horizontal" />
                    </>
                )}
            </HStack>
        );
    }
);
