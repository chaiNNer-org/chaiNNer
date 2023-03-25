/* eslint-disable no-nested-ternary */
import { ViewOffIcon } from '@chakra-ui/icons';
import { Center, HStack, Spinner, Tag, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface LargeTagsProps {
    tags: readonly string[];
}

const LargeTags = memo(({ tags }: LargeTagsProps) => {
    const tagColor = 'var(--tag-bg)';
    const fontColor = 'var(--tag-fg)';

    return (
        <Center mt={1}>
            <Wrap
                justify="center"
                maxW="200px"
                spacing={2}
            >
                {tags.map((tag) => (
                    <WrapItem key={tag}>
                        <Tag
                            bgColor={tagColor}
                            textColor={fontColor}
                        >
                            {tag}
                        </Tag>
                    </WrapItem>
                ))}
            </Wrap>
        </Center>
    );
});

export interface ModelDataTagsProps {
    loading: boolean;
    tags: readonly string[] | undefined;
}

export const ModelDataTags = memo(({ loading, tags }: ModelDataTagsProps) => {
    const { t } = useTranslation();

    return (
        <Center
            h="full"
            minH="2rem"
            overflow="hidden"
            verticalAlign="middle"
            w="full"
        >
            {loading ? (
                <Spinner />
            ) : tags ? (
                <LargeTags tags={tags} />
            ) : (
                <HStack>
                    <ViewOffIcon />
                    <Text
                        fontSize="sm"
                        lineHeight="0.5rem"
                    >
                        {t('outputs.model.modelNotAvailable', 'Model data not available.')}
                    </Text>
                </HStack>
            )}
        </Center>
    );
});
