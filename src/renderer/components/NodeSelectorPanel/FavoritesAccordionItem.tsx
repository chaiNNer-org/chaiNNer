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
                    label={<b>Favorites</b>}
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
                                    Favorites
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
                                text="No Favorites."
                                toolTip={
                                    collapsed ? (
                                        <>
                                            Add Favorites by right-clicking nodes and selecting{' '}
                                            <em>Add to Favorites</em>.
                                        </>
                                    ) : (
                                        <>
                                            Add Favorites by hovering over nodes and clicking the{' '}
                                            <StarIcon style={{ verticalAlign: 'baseline' }} /> icon,
                                            or by right-clicking and selecting{' '}
                                            <em>Add to Favorites</em>.
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
