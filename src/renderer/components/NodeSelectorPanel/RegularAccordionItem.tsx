import {
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Center,
    HStack,
    Heading,
    Text,
    Tooltip,
} from '@chakra-ui/react';
import React, { memo } from 'react';
import { Category, NodeSchema } from '../../../common/common-types';
import { IconFactory } from '../CustomIcons';
import { RepresentativeNodeWrapper } from './RepresentativeNodeWrapper';
import { SubcategoryHeading } from './SubcategoryHeading';
import { TextBox } from './TextBox';

interface RegularAccordionItemProps {
    category: Category;
    collapsed: boolean;
}

export const RegularAccordionItem = memo(
    ({ children, category, collapsed }: React.PropsWithChildren<RegularAccordionItemProps>) => {
        return (
            <AccordionItem key={category.name}>
                <Tooltip
                    closeOnMouseDown
                    hasArrow
                    borderRadius={8}
                    fontSize="1.05rem"
                    isDisabled={!collapsed}
                    label={<b>{category.name}</b>}
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
                                    accentColor={category.color}
                                    icon={category.icon}
                                />
                            </Center>
                            {!collapsed && (
                                <Heading
                                    size="5xl"
                                    textOverflow="clip"
                                    whiteSpace="nowrap"
                                >
                                    {category.name}
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
    hint: string;
    packageName: string;
}

export const PackageHintText = memo(
    ({ hint, packageName }: { hint: string; packageName: string }) => (
        <>
            <Text>{hint}</Text>
            <Text>
                <em>Click</em> to open the dependency manager to install {packageName}.
            </Text>
        </>
    )
);

export const PackageHint = memo(({ collapsed, onClick, hint, packageName }: PackageHintProps) => {
    return (
        <Box pt={1}>
            <TextBox
                noWrap
                collapsed={collapsed}
                height="1.5rem"
                text="Missing dependencies."
                toolTip={
                    <PackageHintText
                        hint={hint}
                        packageName={packageName}
                    />
                }
                onClick={onClick}
            />
        </Box>
    );
});
