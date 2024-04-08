import { Box } from '@chakra-ui/react';
import React, { memo } from 'react';
import { createContext, useContext } from 'use-context-selector';

const IsCollapsedContext = createContext<boolean>(false);

export const CollapsedNode = memo(({ children }: React.PropsWithChildren<unknown>) => {
    return (
        <Box display="none">
            <IsCollapsedContext.Provider value>{children}</IsCollapsedContext.Provider>
        </Box>
    );
});

export const useIsCollapsedNode = (): boolean => {
    return useContext(IsCollapsedContext);
};
