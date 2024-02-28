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
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Category, NodeSchema } from '../../../common/common-types';
import { EMPTY_ARRAY, groupBy } from '../../../common/util';
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

interface OnlyIfVisibleProps {
    height: string;
    visibleOffset?: number;
    children: React.ReactNode;
}
export const OnlyIfVisible = memo(
    ({ height, visibleOffset = 1000, children }: OnlyIfVisibleProps) => {
        interface Foo {
            visible: boolean;
            timestamp: number;
        }
        const [dataPoints, setDataPoints] = useState<readonly Foo[]>(EMPTY_ARRAY);
        const addDataPoint = useCallback((visible: boolean) => {
            setDataPoints((prev) => {
                const now = Date.now();
                return [
                    ...prev.filter((p) => Math.abs(now - p.timestamp) < 1000),
                    { visible, timestamp: now },
                ];
            });
        }, []);

        const intersectionRef = useRef<HTMLDivElement>(null);

        const [checkAgain, setCheckAgain] = useState(-1);

        // Set visibility with intersection observer
        useEffect(() => {
            const root = document;
            if (intersectionRef.current) {
                const localRef = intersectionRef.current;
                const observer = new IntersectionObserver(
                    (entries) => {
                        console.log('change');
                        // addDataPoint(entries[0].isIntersecting);
                        setCheckAgain(0);
                        window.requestIdleCallback(
                            () => {
                                // setCheckAgain((prev) => prev + 1);
                            },
                            {
                                timeout: 600,
                            }
                        );
                    },
                    { root, rootMargin: `${visibleOffset}px 0px ${visibleOffset}px 0px` }
                );

                observer.observe(localRef);
                return () => {
                    observer.unobserve(localRef);
                };
            }
        }, [visibleOffset, addDataPoint]);

        useEffect(() => {
            if (intersectionRef.current && checkAgain < 10) {
                const localRef = intersectionRef.current;
                const timerId = setTimeout(() => {
                    const rect = localRef.getBoundingClientRect();
                    const visible =
                        rect.left < window.innerWidth &&
                        rect.right >= 0 &&
                        rect.top - visibleOffset < window.innerHeight &&
                        rect.bottom + visibleOffset >= 0;
                    addDataPoint(visible);
                    setCheckAgain((prev) => prev + 1);
                }, 2 ** checkAgain + 1);

                return () => clearTimeout(timerId);
            }
        }, [checkAgain, visibleOffset, addDataPoint]);

        const isVisible =
            dataPoints.length > 0 &&
            dataPoints.filter((p) => p.visible).length >= dataPoints.length / 2;

        return (
            <Box
                height={height}
                ref={intersectionRef}
            >
                {isVisible && (
                    <>
                        <Box display="flex" />
                        {children}
                        <Box display="flex" />
                    </>
                )}
            </Box>
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
                const placeholderHeight =
                    nodeHeight * nodes.length + nodePadding * (nodes.length - 1) + 12;

                return (
                    <Box key={group.id}>
                        <Center>
                            <SubcategoryHeading
                                collapsed={collapsed}
                                group={group}
                            />
                        </Center>
                        <OnlyIfVisible
                            height={`${placeholderHeight}px`}
                            key={group.id}
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
                        </OnlyIfVisible>
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
