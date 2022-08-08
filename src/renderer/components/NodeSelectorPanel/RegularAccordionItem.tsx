import {
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Center,
    HStack,
    Heading,
    Tooltip,
} from '@chakra-ui/react';
import React, { ReactNode, memo } from 'react';
import { NodeSchema } from '../../../common/common-types';
import { getNodeAccentColor } from '../../helpers/getNodeAccentColor';
import { IconFactory } from '../CustomIcons';
import { RepresentativeNodeWrapper } from './RepresentativeNodeWrapper';
import { SubcategoryHeading } from './SubcategoryHeading';
import { TextBox } from './TextBox';

interface RegularAccordionItemProps {
    category: string;
    collapsed: boolean;
}

export const RegularAccordionItem = memo(
    ({ children, category, collapsed }: React.PropsWithChildren<RegularAccordionItemProps>) => {
        return (
            <AccordionItem key={category}>
                <Tooltip
                    closeOnMouseDown
                    hasArrow
                    borderRadius={8}
                    fontSize="1.05rem"
                    isDisabled={!collapsed}
                    label={<b>{category}</b>}
                    openDelay={500}
                    px={2}
                    py={1}
                >
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
                </Tooltip>
                <AccordionPanel
                    pb={2.5}
                    pt={0}
                >
                    {children}
                </AccordionPanel>
            </AccordionItem>
        );
    }
);

interface SubcategoriesProps {
    collapsed: boolean;
    subcategoryMap: Map<string, NodeSchema[]>;
}

export const Subcategories = memo(({ collapsed, subcategoryMap }: SubcategoriesProps) => {
    return (
        <>
            {[...subcategoryMap].map(([subcategory, nodes]) => (
                <Box key={subcategory}>
                    <Center>
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
        </>
    );
});

interface PackageHintProps {
    collapsed: boolean;
    onClick: () => void;
    description: () => ReactNode;
}

export const PackageHint = memo(({ collapsed, onClick, description }: PackageHintProps) => {
    return (
        <Box pt={1}>
            <TextBox
                noWrap
                collapsed={collapsed}
                height="1.5rem"
                text="Not installed."
                toolTip={description()}
                onClick={onClick}
            />
        </Box>
    );
});
