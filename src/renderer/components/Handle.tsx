import { Box, SystemStyleObject, Tooltip, chakra } from '@chakra-ui/react';
import React, { memo, useMemo } from 'react';
import { Connection, Position, Handle as RFHandle } from 'reactflow';
import { useContext } from 'use-context-selector';
import { Validity } from '../../common/Validity';
import { FakeNodeContext } from '../contexts/FakeExampleContext';
import { createConicGradient } from '../helpers/colorTools';
import { noContextMenu } from '../hooks/useContextMenu';
import { useIsCollapsedNode } from '../hooks/useIsCollapsedNode';
import { useSettings } from '../hooks/useSettings';
import { Markdown } from './Markdown';

export type HandleType = 'input' | 'output';

interface HandleElementProps {
    type: HandleType;
    isValidConnection: (connection: Readonly<Connection>) => boolean;
    validity: Validity;
    id: string;
    isIterated: boolean;
}

// Had to do this garbage to prevent chakra from clashing the position prop
const HandleElement = memo(
    ({
        children,
        isValidConnection,
        validity,
        type,
        id,
        isIterated,
        ...props
    }: React.PropsWithChildren<HandleElementProps>) => {
        const { isFake } = useContext(FakeNodeContext);

        const squaredHandle = isIterated;
        const borderRadius = squaredHandle ? '15%' : '100%';

        return (
            <Tooltip
                hasArrow
                borderRadius={8}
                display={validity.isValid ? 'none' : 'block'}
                label={
                    validity.isValid ? (
                        'Connection is valid'
                    ) : (
                        <Markdown
                            nonInteractive
                        >{`Unable to connect: ${validity.reason}`}</Markdown>
                    )
                }
                mt={1}
                opacity={validity.isValid ? 0 : 1}
                openDelay={500}
                px={2}
                py={1}
            >
                {isFake ? (
                    <Box
                        bg="#1a192b"
                        border="1px solid white"
                        borderRadius={borderRadius}
                        className={`${type}-handle react-flow__handle react-flow__handle-${
                            type === 'input' ? 'left' : 'right'
                        }`}
                        h="6px"
                        w="6px"
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...props}
                    />
                ) : (
                    <RFHandle
                        isConnectable
                        className={`${type}-handle`}
                        id={id}
                        isValidConnection={isValidConnection}
                        position={type === 'input' ? Position.Left : Position.Right}
                        type={type === 'input' ? 'target' : 'source'}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...props}
                        style={{ borderRadius }}
                    >
                        {children}
                    </RFHandle>
                )}
            </Tooltip>
        );
    }
);

const Div = chakra('div', {
    baseStyle: {},
});

const getComputedColor = (color: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(color);

export interface HandleProps {
    id: string;
    type: HandleType;
    validity: Validity;
    isValidConnection: (connection: Readonly<Connection>) => boolean;
    handleColors: readonly string[];
    connectedColor: readonly string[] | undefined;
    isIterated: boolean;
}

const VisibleHandle = memo(
    ({
        id,
        type,
        validity,
        isValidConnection,
        handleColors,
        connectedColor,
        isIterated,
    }: HandleProps) => {
        const { theme } = useSettings();
        const connectedBg = useMemo(() => {
            return getComputedColor('--connection-color');
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [theme]);

        const handleStyle = useMemo((): SystemStyleObject => {
            const isConnected = !!connectedColor;
            if (!isConnected) {
                return {
                    borderWidth: '0px',
                    borderColor: 'transparent',
                    background: createConicGradient(handleColors),
                };
            }

            const size = 16;
            const rectSize = 12;
            const offset = (size - rectSize) / 2;
            const radius = isIterated ? 1 : rectSize / 2;

            const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'>
                <rect x='${offset}' y='${offset}' width='${rectSize}' height='${rectSize}' rx='${radius}' fill='${connectedBg}' />
            </svg>`;
            const bgImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

            return {
                borderWidth: '0px',
                borderColor: 'transparent',
                background: `${bgImage}, ${createConicGradient(connectedColor)}`,
            };
        }, [connectedColor, handleColors, connectedBg, isIterated]);

        return (
            <Div
                _before={{
                    content: '" "',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    height: '32px',
                    width: '45px',
                    cursor: 'crosshair',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '12px',
                }}
                _hover={{
                    width: '22px',
                    height: '22px',
                    marginRight: '-3px',
                    marginLeft: '-3px',
                    opacity: validity.isValid ? 1 : 0,
                }}
                as={HandleElement}
                className={`${type}-handle`}
                id={id}
                isIterated={isIterated}
                isValidConnection={isValidConnection}
                sx={{
                    width: '16px',
                    height: '16px',
                    transition: '0.15s ease-in-out',
                    transitionProperty: 'width, height, margin, opacity, filter',
                    boxShadow: `${type === 'input' ? '+' : '-'}2px 2px 2px #00000014`,
                    filter: validity.isValid ? undefined : 'grayscale(100%)',
                    opacity: validity.isValid ? 1 : 0.3,
                    position: 'relative',
                    ...handleStyle,
                }}
                type={type}
                validity={validity}
                onContextMenu={noContextMenu}
            />
        );
    }
);
export const Handle = memo(
    ({
        id,
        type,
        validity,
        isValidConnection,
        handleColors,
        connectedColor,
        isIterated,
    }: HandleProps) => {
        const isCollapsed = useIsCollapsedNode();
        if (isCollapsed) return null;
        return (
            <VisibleHandle
                connectedColor={connectedColor}
                handleColors={handleColors}
                id={id}
                isIterated={isIterated}
                isValidConnection={isValidConnection}
                type={type}
                validity={validity}
            />
        );
    }
);
