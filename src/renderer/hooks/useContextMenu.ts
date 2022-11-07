import { MouseEvent, MouseEventHandler, useCallback, useEffect, useState } from 'react';
import { useContext } from 'use-context-selector';
import { createUniqueId } from '../../common/util';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { useMemoObject } from './useMemo';

export interface UseContextMenu {
    readonly id: string;
    readonly onContextMenu: MouseEventHandler;
    readonly onClick: MouseEventHandler;
    readonly manuallyOpenContextMenu: (pageX: number, pageY: number) => void;
}

export const useContextMenu = (render: () => JSX.Element): UseContextMenu => {
    const { registerContextMenu, unregisterContextMenu, openContextMenu } =
        useContext(ContextMenuContext);

    // eslint-disable-next-line react/hook-use-state
    const [id] = useState(createUniqueId);

    useEffect(() => {
        return () => unregisterContextMenu(id);
    }, [unregisterContextMenu, id]);

    useEffect(() => {
        registerContextMenu(id, render);
    }, [registerContextMenu, id, render]);

    const onContextMenu = useCallback(
        (e: MouseEvent): void => {
            if (e.isDefaultPrevented()) return;

            e.stopPropagation();
            e.preventDefault();
            openContextMenu(id, e.pageX, e.pageY);
        },
        [openContextMenu, id]
    );

    const manuallyOpenContextMenu = useCallback(
        (pageX: number, pageY: number): void => {
            openContextMenu(id, pageX, pageY);
        },
        [openContextMenu, id]
    );

    const onClick = useCallback(
        (e: MouseEvent): void => {
            if (e.isDefaultPrevented()) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            openContextMenu(id, e.pageX - x + rect.width, e.pageY - y + rect.height);
        },
        [openContextMenu, id]
    );

    return useMemoObject<UseContextMenu>({
        id,
        onContextMenu,
        onClick,
        manuallyOpenContextMenu,
    });
};

export const noContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
};
