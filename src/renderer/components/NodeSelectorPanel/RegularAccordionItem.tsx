import {
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Center,
    Checkbox,
    HStack,
    Heading,
    Text,
    Tooltip,
} from '@chakra-ui/react';
import React, { memo } from 'react';
import { Category, NodeSchema } from '../../../common/common-types';
import { useNodeHidden } from '../../hooks/useNodeHidden';
import { IconFactory } from '../CustomIcons';
import { RepresentativeNodeWrapper } from './RepresentativeNodeWrapper';
import { SubcategoryHeading } from './SubcategoryHeading';
import { TextBox } from './TextBox';

export enum Checked {
    All,
    None,
    Some,
}

interface RegularAccordionItemProps {
    category: Category;
    collapsed: boolean;
    nodes?: NodeSchema[];
    visMode: boolean;
    visState: Checked;
}

export const RegularAccordionItem = memo(
    ({
        children,
        category,
        collapsed,
        nodes,
        visMode,
        visState,
    }: React.PropsWithChildren<RegularAccordionItemProps>) => {
        const { addHidden, removeHidden } = useNodeHidden();
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
                        {visMode && (
                            <Checkbox
                                isChecked={visState === Checked.All}
                                isIndeterminate={visState === Checked.Some}
                                onChange={() => {
                                    if (visState === Checked.All) {
                                        nodes?.map((n) => addHidden(n.schemaId));
                                    } else {
                                        nodes?.map((n) => removeHidden(n.schemaId));
                                    }
                                }}
                            />
                        )}
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
    visModeActive: boolean;
    subcategoryMap: Map<string, NodeSchema[]>;
}

export const Subcategories = memo(
    ({ collapsed, visModeActive, subcategoryMap }: SubcategoriesProps) => {
        const { hidden, addHidden, removeHidden } = useNodeHidden();

        const visStateMap = new Map(
            [...subcategoryMap].map(([subcategory, nodes]) => {
                const count = nodes.filter((n) => hidden.has(n.schemaId)).length;
                const partialState = count === nodes.length ? Checked.None : Checked.Some;
                const state = count === 0 ? Checked.All : partialState;
                return [subcategory, state];
            })
        );

        return (
            <>
                {[...subcategoryMap].map(([subcategory, nodes]) => (
                    <Box key={subcategory}>
                        <Center>
                            <HStack w="full">
                                <SubcategoryHeading
                                    collapsed={collapsed}
                                    subcategory={subcategory}
                                />
                                {visModeActive && (
                                    <Checkbox
                                        isChecked={visStateMap.get(subcategory) === Checked.All}
                                        isIndeterminate={
                                            visStateMap.get(subcategory) === Checked.Some
                                        }
                                        onChange={() => {
                                            if (visStateMap.get(subcategory) === Checked.All) {
                                                nodes.map((n) => addHidden(n.schemaId));
                                            } else {
                                                nodes.map((n) => removeHidden(n.schemaId));
                                            }
                                        }}
                                    />
                                )}
                            </HStack>
                        </Center>
                        <Box>
                            {nodes.map((node) => (
                                <RepresentativeNodeWrapper
                                    collapsed={collapsed}
                                    key={node.schemaId}
                                    node={node}
                                    visModeActive={visModeActive}
                                />
                            ))}
                        </Box>
                    </Box>
                ))}
            </>
        );
    }
);

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
