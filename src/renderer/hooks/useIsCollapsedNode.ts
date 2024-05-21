import { useContext } from 'use-context-selector';
import { IsCollapsedContext } from '../contexts/CollapsedNodeContext';

export const useIsCollapsedNode = (): boolean => {
    return useContext(IsCollapsedContext);
};
