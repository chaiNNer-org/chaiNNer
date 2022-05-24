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
} from '@chakra-ui/react';
import { memo } from 'react';
import { NodeSchema } from '../../../common/common-types';
import RepresentativeNodeWrapper from './RepresentativeNodeWrapper';
import { TextBox } from './TextBox';

interface FavoritesAccordionItemProps {
    favoriteNodes: NodeSchema[];
    collapsed: boolean;
}

const FavoritesAccordionItem = memo(({ favoriteNodes, collapsed }: FavoritesAccordionItemProps) => {
    return (
        <AccordionItem>
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
            <AccordionPanel
                pb={2.5}
                pt={0}
            >
                <Box>
                    {favoriteNodes.length > 0 ? (
                        favoriteNodes
                            .filter((e) => e.nodeType !== 'iteratorHelper')
                            .map((node) => (
                                <RepresentativeNodeWrapper
                                    collapsed={collapsed}
                                    key={node.name}
                                    node={node}
                                />
                            ))
                    ) : (
                        <TextBox
                            text="No Favorites."
                            toolTip={
                                <>
                                    Add Favorites by hovering over nodes and clicking the{' '}
                                    <StarIcon style={{ verticalAlign: 'baseline' }} /> icon.
                                </>
                            }
                        />
                    )}
                </Box>
            </AccordionPanel>
        </AccordionItem>
    );
});

export { FavoritesAccordionItem };
