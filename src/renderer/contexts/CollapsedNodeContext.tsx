import { Box } from '@chakra-ui/react';
import React, { memo } from 'react';
import { createContext } from 'use-context-selector';

export const IsCollapsedContext = createContext<boolean>(false);

export const CollapsedNode = memo(({ children }: React.PropsWithChildren<unknown>) => {
    return (
        <Box
            display="none"
            style={{ contain: 'strict' }}
        >
            <IsCollapsedContext.Provider value>{children}</IsCollapsedContext.Provider>
        </Box>
    );
});
