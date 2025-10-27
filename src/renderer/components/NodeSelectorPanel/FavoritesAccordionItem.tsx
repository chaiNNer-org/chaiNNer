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
import { useTranslation } from 'react-i18next';
import { NodeSchema } from '../../../common/common-types';
import { NodeRepresentativeList } from './NodeRepresentative';
import { TextBox } from './TextBox';

interface FavoritesAccordionItemProps {
    favoriteNodes: NodeSchema[];
    noFavorites: boolean;
    collapsed: boolean;
}

export const FavoritesAccordionItem = memo(
    ({ favoriteNodes, noFavorites, collapsed }: FavoritesAccordionItemProps) => {
        const { t } = useTranslation();
        return (
            <AccordionItem>
                <Tooltip
                    closeOnMouseDown
                    hasArrow
                    borderRadius={8}
                    fontSize="1.05rem"
                    isDisabled={!collapsed}
                    label={<b>{t('favorites.title', 'Favorites')}</b>}
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
                                    {t('favorites.title', 'Favorites')}
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
                            <NodeRepresentativeList
                                collapsed={collapsed}
                                nodes={favoriteNodes}
                            />
                        ) : (
                            <TextBox
                                noWrap
                                collapsed={collapsed}
                                height="1.5rem"
                                text={t('favorites.noFavorites', 'No Favorites.')}
                                toolTip={
                                    collapsed ? (
                                        <>
                                            {t(
                                                'favorites.addFavoritesTooltip',
                                                'Add Favorites by right-clicking nodes and selecting Add to Favorites.'
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {t(
                                                'favorites.addFavoritesTooltipExpanded.beforeIcon',
                                                'Add Favorites by hovering over nodes and clicking the'
                                            )}{' '}
                                            <StarIcon style={{ verticalAlign: 'baseline' }} />{' '}
                                            {t(
                                                'favorites.addFavoritesTooltipExpanded.afterIcon',
                                                'icon, or by right-clicking and selecting Add to Favorites.'
                                            )}
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
