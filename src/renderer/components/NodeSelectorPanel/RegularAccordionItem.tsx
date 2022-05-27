import {
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Center,
    HStack,
    Heading,
} from '@chakra-ui/react';
import { memo } from 'react';
import { NodeSchema } from '../../../common/common-types';
import getNodeAccentColor from '../../helpers/getNodeAccentColors';
import { IconFactory } from '../CustomIcons';
import RepresentativeNodeWrapper from './RepresentativeNodeWrapper';
import SubcategoryHeading from './SubcategoryHeading';

interface RegularAccordionItemProps {
    subcategoryMap: Map<string, NodeSchema[]>;
    category: string;
    collapsed: boolean;
}

const RegularAccordionItem = memo(
    ({ subcategoryMap, category, collapsed }: RegularAccordionItemProps) => {
        return (
            <AccordionItem key={category}>
                <AccordionButton>
                    <HStack
                        flex="1"
                        h={6}
                        textAlign="left"
                        verticalAlign="center"
                    >
                        <Center>
                            <IconFactory
                                accentColor={getNodeAccentColor(category)}
                                icon={category}
                            />
                        </Center>
                        {!collapsed && (
                            <Heading
                                size="5xl"
                                textOverflow="clip"
                                whiteSpace="nowrap"
                            >
                                {category}
                            </Heading>
                        )}
                    </HStack>
                    <AccordionIcon />
                </AccordionButton>
                <AccordionPanel
                    pb={2.5}
                    pt={0}
                >
                    {[...subcategoryMap].map(([subcategory, nodes]) => (
                        <Box key={subcategory}>
                            <Center
                            // w="full"
                            >
                                <SubcategoryHeading
                                    collapsed={collapsed}
                                    subcategory={subcategory}
                                />
                            </Center>
                            <Box>
                                {nodes.map((node) => (
                                    <RepresentativeNodeWrapper
                                        collapsed={collapsed}
                                        key={node.name}
                                        node={node}
                                    />
                                ))}
                            </Box>
                        </Box>
                    ))}
                </AccordionPanel>
            </AccordionItem>
        );
    }
);

export { RegularAccordionItem };
