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
import { groupBy } from '../../../common/util';
import { IconFactory } from '../CustomIcons';
import { IfVisible } from '../IfVisible';
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
            <AccordionItem
                cursor="pointer"
                key={category.name}
            >
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
                    <AccordionButton cursor="pointer">
                        <HStack
                            cursor="pointer"
                            flex="1"
                            h={6}
                            textAlign="left"
                            verticalAlign="center"
                        >
                            <Center cursor="pointer">
                                <IconFactory
                                    accentColor={category.color}
                                    icon={category.icon}
                                />
                            </Center>
                            {!collapsed && (
                                <Heading
                                    cursor="pointer"
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
    category: Category;
    categoryNodes: readonly NodeSchema[];
}

export const Subcategories = memo(({ collapsed, category, categoryNodes }: SubcategoriesProps) => {
    const byGroup = groupBy(categoryNodes, 'nodeGroup');
    return (
        <>
            {category.groups.map((group) => {
                const nodes = byGroup.get(group.id);
                if (!nodes) return null;

                const nodeHeight = 28;
                const nodePadding = 6;

                return (
                    <Box key={group.id}>
                        <Center>
                            <SubcategoryHeading
                                collapsed={collapsed}
                                group={group}
                            />
                        </Center>
                        <IfVisible
                            height={nodeHeight * nodes.length + nodePadding * (nodes.length + 1)}
                            visibleOffset={600}
                        >
                            <Box>
                                {nodes.map((node) => (
                                    <RepresentativeNodeWrapper
                                        collapsed={collapsed}
                                        key={node.schemaId}
                                        node={node}
                                    />
                                ))}
                            </Box>
                        </IfVisible>
                    </Box>
                );
            })}
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
    ({ hint, packageName }: { hint?: string; packageName: string }) => (
        <>
            <Text>
                {hint ||
                    `A critical import error has occurred with a dependency in package: ${packageName}.`}
            </Text>
            <Text display={hint ? 'inherit' : 'none'}>
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
                text={hint ? 'Missing dependencies.' : 'Unable to import node(s).'}
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
