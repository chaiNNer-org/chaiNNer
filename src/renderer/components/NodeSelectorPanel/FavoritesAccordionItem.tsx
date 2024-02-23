import { StarIcon } from '@chakra-ui/icons';
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
import { memo } from 'react';
import { NodeSchema } from '../../../common/common-types';
import { RepresentativeNodeWrapper } from './RepresentativeNodeWrapper';
import { TextBox } from './TextBox';

interface FavoritesAccordionItemProps {
    favoriteNodes: NodeSchema[];
    noFavorites: boolean;
    collapsed: boolean;
}

export const FavoritesAccordionItem = memo(
    ({ favoriteNodes, noFavorites, collapsed }: FavoritesAccordionItemProps) => {
        return (
            <AccordionItem>
                <Tooltip
                    closeOnMouseDown
                    hasArrow
                    borderRadius={8}
                    fontSize="1.05rem"
                    isDisabled={!collapsed}
                    label={<b>收藏夹</b>}
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
                                <StarIcon color="yellow.500" />
                            </Center>
                            {!collapsed && (
                                <Heading
                                    size="5xl"
                                    textOverflow="clip"
                                    whiteSpace="nowrap"
                                >
                                    收藏夹
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
                    <Box>
                        {!noFavorites ? (
                            favoriteNodes.map((node) => (
                                <RepresentativeNodeWrapper
                                    collapsed={collapsed}
                                    key={node.schemaId}
                                    node={node}
                                />
                            ))
                        ) : (
                            <TextBox
                                noWrap
                                collapsed={collapsed}
                                height="1.5rem"
                                text="没有收藏夹"
                                toolTip={
                                    collapsed ? (
                                        <>
                                            通过右键单击节点并选择“添加收藏夹”{' '}
                                            <em>添加到收藏夹</em>.
                                        </>
                                    ) : (
                                        <>
                                            将鼠标悬停在节点上并单击{' '}
                                            <StarIcon style={{ 垂直对齐: 'baseline' }} /> icon,
                                            或者右键单击并选择{' '}
                                            <em>添加到收藏夹</em>.
                                        </>
                                    )
                                }
                            />
                        )}
                    </Box>
                </AccordionPanel>
            </AccordionItem>
        );
    }
);
