import {
    Center,
    Icon,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverContent,
    PopoverTrigger,
    Portal,
} from '@chakra-ui/react';
import { memo } from 'react';
import { IoMdFastforward } from 'react-icons/io';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { UseDisabled } from '../../../hooks/useDisabled';
import { UsePassthrough } from '../../../hooks/usePassthrough';

interface DisableSwitchProps {
    disable: UseDisabled;
    passthrough: UsePassthrough;
}

const enum DisableMode {
    Enabled,
    Disabled,
    Skipped,
}

const icon = {
    [DisableMode.Enabled]: MdPlayArrow,
    [DisableMode.Disabled]: MdPlayDisabled,
    [DisableMode.Skipped]: IoMdFastforward,
} as const;

export const DisableSwitch = memo(({ disable, passthrough }: DisableSwitchProps) => {
    // eslint-disable-next-line no-nested-ternary
    const mode = disable.isDirectlyDisabled
        ? DisableMode.Disabled
        : passthrough.isPassthrough
        ? DisableMode.Skipped
        : DisableMode.Enabled;

    return (
        <Popover
            isLazy
            placement="bottom-start"
        >
            <PopoverTrigger>
                <Center
                    className="nodrag"
                    cursor="pointer"
                    h={6}
                    w={7}
                >
                    <Center
                        bgColor={mode === DisableMode.Enabled ? undefined : 'var(--node-timer-bg)'}
                        borderRadius="0.5rem"
                        cursor="pointer"
                        h={4}
                        w={7}
                    >
                        <Icon
                            as={icon[mode]}
                            boxSize="0.9rem"
                            color={mode === DisableMode.Enabled ? undefined : undefined}
                        />
                    </Center>
                </Center>
            </PopoverTrigger>
            <Portal>
                <PopoverContent>
                    <PopoverArrow />
                    <PopoverBody>
                        Enable
                        <br />
                        Skip
                        <br />
                        Disable
                    </PopoverBody>
                </PopoverContent>
            </Portal>
        </Popover>
    );
});
