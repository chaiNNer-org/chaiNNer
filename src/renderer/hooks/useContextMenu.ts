import { MouseEvent, MouseEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import { useContext } from 'use-context-selector';
import { createUniqueId } from '../../common/util';
import { ContextMenuContext } from '../contexts/ContextMenuContext';

export interface UseContextMenu {
    readonly id: string;
    readonly onContextMenu: MouseEventHandler;
    readonly onClick: MouseEventHandler;
    readonly manuallyOpenContextMenu: (pageX: number, pageY: number) => void;
}

export const useContextMenu = (
    render: () => JSX.Element,
    deps?: readonly unknown[]
): UseContextMenu => {
    const { registerContextMenu, unregisterContextMenu, openContextMenu } =
        useContext(ContextMenuContext);

    const [id] = useState(createUniqueId);

    useEffect(() => {
        return () => unregisterContextMenu(id);
    }, []);

    useEffect(() => {
        registerContextMenu(id, render);
    }, deps);

    const onContextMenu = useCallback(
        (e: MouseEvent): void => {
            if (e.isDefaultPrevented()) return;

            e.stopPropagation();
            e.preventDefault();
            openContextMenu(id, e.pageX, e.pageY);
        },
        [openContextMenu]
    );

    const manuallyOpenContextMenu = useCallback(
        (pageX: number, pageY: number): void => {
            openContextMenu(id, pageX, pageY);
        },
        [openContextMenu]
    );

    const onClick = useCallback(
        (e: MouseEvent): void => {
            if (e.isDefaultPrevented()) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            openContextMenu(id, e.pageX - x + rect.width, e.pageY - y + rect.height);
        },
        [openContextMenu]
    );

    let value: UseContextMenu = { id, onContextMenu, onClick, manuallyOpenContextMenu };
    value = useMemo(() => value, Object.values(value));

    return value;
};

export const noContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
};
