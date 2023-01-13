import { Center, Tag, Wrap, WrapItem } from '@chakra-ui/react';
import { memo } from 'react';

export interface LargeTagsProps {
    tags: readonly string[];
}

export const LargeTags = memo(({ tags }: LargeTagsProps) => {
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
