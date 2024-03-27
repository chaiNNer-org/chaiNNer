import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import { useInView } from 'react-intersection-observer';

export interface IfVisibleProps {
    height: string | number;
    visibleOffset?: number;
    forceVisible?: boolean;
    children: React.ReactNode;
}
export const IfVisible = memo(
    ({ height, visibleOffset = 200, forceVisible = false, children }: IfVisibleProps) => {
        const { ref, entry } = useInView({
            rootMargin: `${visibleOffset}px 0px ${visibleOffset}px 0px`,
        });

        const finalVisibility = forceVisible || (entry?.isIntersecting ?? false);

        return (
            <Box
                height={typeof height === 'number' ? `${height}px` : height}
                ref={ref}
                style={{ contain: 'layout size' }}
            >
                {finalVisibility && (
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
