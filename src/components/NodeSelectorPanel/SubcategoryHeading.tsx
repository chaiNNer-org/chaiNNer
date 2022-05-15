import { Divider, HStack, Text } from '@chakra-ui/react';
import { memo } from 'react';

interface SubcategoryHeadingProps {
    subcategory: string;
}

const SubcategoryHeading = ({ subcategory }: SubcategoryHeadingProps) => {
    return (
        <HStack w="full">
            <Divider orientation="horizontal" />
            <Text
                casing="uppercase"
                color="#71809699"
                fontSize="sm"
                py={1}
                // w="auto"
                whiteSpace="nowrap"
            >
                {subcategory}
            </Text>
            <Divider orientation="horizontal" />
        </HStack>
    );
};

export default memo(SubcategoryHeading);
