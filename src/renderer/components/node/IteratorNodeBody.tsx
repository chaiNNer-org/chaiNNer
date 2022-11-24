import { Box, Flex, Icon, Spacer } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { memo, useLayoutEffect, useState } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { IteratorSize } from '../../../common/common-types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { noContextMenu } from '../../hooks/useContextMenu';
import { useMemoArray } from '../../hooks/useMemo';

const createGridDotsPath = (size: number, fill: string) => (
    <circle
        cx={size}
        cy={size}
        fill={fill}
        r={size}
    />
);

const DotPattern = memo(({ id }: { id: string }) => {
    const gap = 15;
    const size = 0.5;
    const scaledGap = gap * 1;
    const path = createGridDotsPath(size, '#81818a');
    const patternId = `pattern-${id}`;

    return (
        <svg
            style={{
                width: '100%',
                height: '100%',
                borderRadius: '0.5rem',
            }}
        >
            <pattern
                className={`iterator-editor=${id}`}
                height={scaledGap}
                id={patternId}
                patternUnits="userSpaceOnUse"
                width={scaledGap}
                x={6}
                y={6}
            >
                {path}
            </pattern>
            <rect
                className={`iterator-editor=${id}`}
                fill={`url(#${patternId})`}
                height="100%"
                width="100%"
                x="0"
                y="0"
            />
        </svg>
    );
});

interface IteratorNodeBodyProps {
    id: string;
    iteratorSize?: IteratorSize;
    accentColor: string;
    minWidth?: number;
    minHeight?: number;
}

export const IteratorNodeBody = memo(
    ({ id, iteratorSize, accentColor, minWidth = 256, minHeight = 256 }: IteratorNodeBodyProps) => {
        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);
        const hoveredNode = useContextSelector(GlobalVolatileContext, (c) => c.hoveredNode);
        const { defaultIteratorSize, setIteratorSize, setHoveredNode, updateIteratorBounds } =
            useContext(GlobalContext);

        const { useSnapToGrid } = useContext(SettingsContext);
        const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

        const { width, height } = iteratorSize ?? defaultIteratorSize;

        const [resizeRef, setResizeRef] = useState<Resizable | null>(null);

        useLayoutEffect(() => {
            if (resizeRef && resizeRef.resizable) {
                const { resizable } = resizeRef;
                const size = {
                    offsetTop: resizable.offsetTop,
                    offsetLeft: resizable.offsetLeft,
                    width,
                    height,
                };
                setIteratorSize(id, size);
                updateIteratorBounds(id, size);
            }
        }, [
            resizeRef,
            resizeRef?.resizable,
            setIteratorSize,
            updateIteratorBounds,
            height,
            width,
            id,
        ]);

        const shade = 'var(--chain-editor-bg)';

        return (
            <Resizable
                className="nodrag"
                defaultSize={iteratorSize ?? defaultIteratorSize}
                enable={{
                    top: false,
                    right: true,
                    bottom: true,
                    left: false,
                    topRight: false,
                    bottomRight: true,
                    bottomLeft: false,
                    topLeft: false,
                }}
                grid={useMemoArray<[number, number]>(
                    isSnapToGrid ? [snapToGridAmount, snapToGridAmount] : [1, 1]
                )}
                minHeight={minHeight}
                minWidth={minWidth}
                ref={(r) => {
                    setResizeRef(r);
                }}
                scale={zoom}
                style={{
                    margin: 8,
                    marginBottom: 0,
                    marginTop: 0,
                }}
                onResizeStop={(e, direction, ref, d) => {
                    const size = {
                        offsetTop: ref.offsetTop,
                        offsetLeft: ref.offsetLeft,
                        width: (width < minWidth ? minWidth : width) + d.width,
                        height: (height < minHeight ? minHeight : height) + d.height,
                    };
                    setIteratorSize(id, size);
                    updateIteratorBounds(id, size);
                }}
            >
                <Box
                    className="nodrag"
                    draggable={false}
                    h="full"
                    my={0}
                    w="full"
                    onContextMenu={noContextMenu}
                    onDragEnter={() => {
                        setHoveredNode(id);
                    }}
                    onDragLeave={() => {
                        setHoveredNode(null);
                    }}
                >
                    <Box
                        bg={shade}
                        borderColor={hoveredNode === id ? accentColor : shade}
                        borderRadius="lg"
                        borderWidth={1}
                        h="full"
                        transition="0.15s ease-in-out"
                        w="full"
                    >
                        <DotPattern id={id} />
                        <Flex
                            mt={-2.5}
                            w="full"
                        >
                            <Spacer />
                            <Icon
                                color="var(--fg-300)"
                                mr={-1.5}
                                opacity={0.75}
                                position="relative"
                                stroke="var(--fg-300)"
                            >
                                <polyline
                                    fill="none"
                                    points="8 20 20 20 20 8"
                                    stroke="var(--fg-300)"
                                    strokeWidth="2"
                                />
                            </Icon>
                        </Flex>
                    </Box>
                </Box>
            </Resizable>
        );
    }
);
