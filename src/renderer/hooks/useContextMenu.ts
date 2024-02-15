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
    readonly position: { x: number; y: number };
}

export const useContextMenu = (
    render: (event: MouseEvent | null) => JSX.Element
): UseContextMenu => {
    const { registerContextMenu, unregisterContextMenu, openContextMenu } =
        useContext(ContextMenuContext);

    // eslint-disable-next-line react/hook-use-state
    const [id] = useState(createUniqueId);

    const [event, setEvent] = useState<MouseEvent | null>(null);

    const [position, setPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        return () => unregisterContextMenu(id);
    }, [unregisterContextMenu, id]);

    useEffect(() => {
        registerContextMenu(id, () => render(event));
    }, [registerContextMenu, id, render, event]);

    const onContextMenu = useCallback(
        (e: MouseEvent): void => {
            if (e.isDefaultPrevented()) return;

            setEvent(e);

            e.stopPropagation();
            e.preventDefault();
            openContextMenu(id, e.pageX, e.pageY);
            setPosition({ x: e.pageX, y: e.pageY });
        },
        [openContextMenu, id]
    );

    const manuallyOpenContextMenu = useCallback(
        (pageX: number, pageY: number): void => {
            openContextMenu(id, pageX, pageY);
            setPosition({ x: pageX, y: pageY });
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
            setPosition({ x: e.pageX - x + rect.width, y: e.pageY - y + rect.height });
        },
        [openContextMenu, id]
    );

    return useMemoObject<UseContextMenu>({
        id,
        onContextMenu,
        onClick,
        manuallyOpenContextMenu,
        position,
    });
};

export const noContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
};
