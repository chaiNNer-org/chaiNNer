import { Button, HStack, Tooltip, VStack } from '@chakra-ui/react';
import { memo } from 'react';
import {
    BsArrowDown,
    BsArrowDownLeft,
    BsArrowDownRight,
    BsArrowLeft,
    BsArrowRight,
    BsArrowUp,
    BsArrowUpLeft,
    BsArrowUpRight,
    BsDot,
} from 'react-icons/bs';
import { DropDownInput, InputSchemaValue } from '../../../../common/common-types';
import { IconFactory } from '../../CustomIcons';

const indexes = [0, 1, 2] as const;

type OffsetKey = string & { __offsetKey: never };
const getOffsetKey = (x: number, y: number) => `${y} ${x}` as OffsetKey;
const otherIcons: Partial<Record<OffsetKey, JSX.Element>> = {
    [getOffsetKey(-1, 0)]: <BsArrowLeft opacity={0.7} />,
    [getOffsetKey(+1, 0)]: <BsArrowRight opacity={0.7} />,
    [getOffsetKey(0, -1)]: <BsArrowUp opacity={0.7} />,
    [getOffsetKey(0, +1)]: <BsArrowDown opacity={0.7} />,
    [getOffsetKey(-1, -1)]: <BsArrowUpLeft opacity={0.7} />,
    [getOffsetKey(+1, +1)]: <BsArrowDownRight opacity={0.7} />,
    [getOffsetKey(+1, -1)]: <BsArrowUpRight opacity={0.7} />,
    [getOffsetKey(-1, +1)]: <BsArrowDownLeft opacity={0.7} />,
};

export interface AnchorSelectorProps {
    value: InputSchemaValue;
    onChange: (value: InputSchemaValue) => void;
    isDisabled?: boolean;
    options: DropDownInput['options'];
}

export const AnchorSelector = memo(
    ({ value, onChange, isDisabled, options }: AnchorSelectorProps) => {
        let selectedIndex = options.findIndex((o) => o.value === value);
        if (selectedIndex === -1) selectedIndex = 0;

        const selectedY = Math.floor(selectedIndex / indexes.length);
        const selectedX = selectedIndex % indexes.length;

        return (
            <VStack
                className="nodrag"
                display="inline-flex"
                spacing={0}
            >
                {indexes.map((y) => (
                    <HStack
                        key={y}
                        spacing={0}
                    >
                        {indexes.map((x) => {
                            const o = options[y * indexes.length + x];
                            const selected = value === o.value;

                            let icon;
                            if (selected) {
                                icon = <IconFactory icon={o.icon} />;
                            } else {
                                icon = otherIcons[getOffsetKey(x - selectedX, y - selectedY)] ?? (
                                    <BsDot opacity={0.7} />
                                );
                            }

                            return (
                                <Tooltip
                                    closeOnClick
                                    closeOnPointerDown
                                    hasArrow
                                    borderRadius={8}
                                    isDisabled={isDisabled}
                                    key={x}
                                    label={o.option}
                                    openDelay={1000}
                                    placement="top"
                                >
                                    <Button
                                        border={selected ? '1px solid' : undefined}
                                        borderBottomLeftRadius={y === 2 && x === 0 ? 'md' : '0'}
                                        borderBottomRightRadius={y === 2 && x === 2 ? 'md' : '0'}
                                        borderBottomWidth={selectedY !== y + 1 ? '1px' : '0px'}
                                        borderLeftWidth={selectedX === x || x === 0 ? '1px' : '0px'}
                                        borderRightWidth={selectedX !== x + 1 ? '1px' : '0px'}
                                        borderTopLeftRadius={y === 0 && x === 0 ? 'md' : '0'}
                                        borderTopRightRadius={y === 0 && x === 2 ? 'md' : '0'}
                                        borderTopWidth={selectedY === y || y === 0 ? '1px' : '0px'}
                                        boxSizing="content-box"
                                        height={7}
                                        isDisabled={isDisabled}
                                        minWidth={0}
                                        px={2}
                                        variant={selected ? 'solid' : 'outline'}
                                        width={4}
                                        onClick={() => onChange(o.value)}
                                    >
                                        {icon}
                                    </Button>
                                </Tooltip>
                            );
                        })}
                    </HStack>
                ))}
            </VStack>
        );
    }
);
