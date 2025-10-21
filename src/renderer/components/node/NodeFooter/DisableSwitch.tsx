import {
    Box,
    Button,
    Center,
    Icon,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverContent,
    PopoverTrigger,
    Portal,
    Text,
    Tooltip,
    useDisclosure,
} from '@chakra-ui/react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IoMdFastforward } from 'react-icons/io';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { UseDisabled } from '../../../hooks/useDisabled';
import { UsePassthrough } from '../../../hooks/usePassthrough';

interface MenuOptionProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    isDisabled?: boolean;
}
const MenuOption = memo(({ icon: ButtonIcon, label, onClick, isDisabled }: MenuOptionProps) => {
    return (
        <Button
            borderRadius={0}
            display="block"
            isDisabled={isDisabled}
            leftIcon={<ButtonIcon />}
            textAlign="left"
            variant="ghost"
            w="full"
            onClick={onClick}
        >
            {label}
        </Button>
    );
});

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

interface DisableSwitchProps {
    disable: UseDisabled;
    passthrough: UsePassthrough;
}

export const DisableSwitch = memo(({ disable, passthrough }: DisableSwitchProps) => {
    const { t } = useTranslation();
    // eslint-disable-next-line no-nested-ternary
    const mode = disable.isDirectlyDisabled
        ? DisableMode.Disabled
        : passthrough.isPassthrough && passthrough.canPassthrough
        ? DisableMode.Skipped
        : DisableMode.Enabled;

    const availableModes: readonly DisableMode[] = passthrough.canPassthrough
        ? [DisableMode.Enabled, DisableMode.Disabled, DisableMode.Skipped]
        : [DisableMode.Enabled, DisableMode.Disabled];

    const { isOpen, onToggle, onClose } = useDisclosure();

    const lastMouseDownRef = useRef<number | null>(null);
    const lastOnCloseRef = useRef<number | null>(null);

    const setMode = (newMode: DisableMode) => {
        switch (newMode) {
            case DisableMode.Enabled:
                disable.setDirectlyDisabled(false);
                passthrough.setIsPassthrough(false);
                break;
            case DisableMode.Disabled:
                disable.setDirectlyDisabled(true);
                passthrough.setIsPassthrough(false);
                break;
            case DisableMode.Skipped:
                disable.setDirectlyDisabled(false);
                passthrough.setIsPassthrough(true);
                break;
            default:
                break;
        }

        onClose();
    };

    const cycleMode = () => {
        const index = availableModes.indexOf(mode);
        const nextIndex = (index + 1) % availableModes.length;
        setMode(availableModes[nextIndex]);
    };

    const tooltipState = {
        [DisableMode.Enabled]: 'This node is enabled and will be executed.',
        [DisableMode.Disabled]:
            'This node is disabled. It and all of its downstream nodes will not be executed.',
        [DisableMode.Skipped]: 'This node is skip and will not be executed.',
    }[mode];

    let tooltipActions: string;
    if (passthrough.canPassthrough) {
        // eslint-disable-next-line no-nested-ternary
        tooltipActions = disable.isDirectlyDisabled
            ? 'Click to enable or skip this node.'
            : passthrough.isPassthrough
            ? 'Click to enable or disable this node.'
            : 'Click to skip or disable this node.';
    } else {
        tooltipActions = disable.isDirectlyDisabled
            ? 'Click to enable this node.'
            : 'Click to disable this node.';
    }

    return (
        <Popover
            isLazy
            isOpen={isOpen}
            placement="bottom-start"
            onClose={() => {
                lastOnCloseRef.current = Date.now();
                onClose();
            }}
        >
            <PopoverTrigger>
                <Center
                    className="nodrag"
                    cursor="pointer"
                    h={6}
                    w={7}
                    onClick={(e) => {
                        if (e.ctrlKey) {
                            cycleMode();
                            return;
                        }
                        if (
                            lastMouseDownRef.current &&
                            lastOnCloseRef.current &&
                            Math.abs(lastMouseDownRef.current - lastOnCloseRef.current) < 100
                        ) {
                            // the popover was closed because the user clicked the button
                            return;
                        }
                        onToggle();
                    }}
                    onMouseDown={() => {
                        lastMouseDownRef.current = Date.now();
                    }}
                >
                    <Tooltip
                        hasArrow
                        borderRadius={8}
                        isDisabled={isOpen}
                        label={
                            <>
                                <Text>{tooltipState}</Text>
                                <Text mt={2}>{tooltipActions}</Text>
                                <Text
                                    fontSize="small"
                                    mt={3}
                                >
                                    {t('node.disable.hint', 'Hint: Use Ctrl+Click to cycle through options.')}
                                </Text>
                            </>
                        }
                        openDelay={500}
                        px={2}
                        textAlign="center"
                    >
                        <Center
                            h="full"
                            w="full"
                        >
                            <Center
                                bgColor={
                                    mode === DisableMode.Enabled
                                        ? undefined
                                        : 'var(--node-disable-bg)'
                                }
                                borderRadius="0.5rem"
                                cursor="pointer"
                                h={4}
                                w={7}
                            >
                                <Icon
                                    as={icon[mode]}
                                    boxSize="0.9rem"
                                    color={
                                        mode === DisableMode.Enabled
                                            ? 'var(--node-disable-fg)'
                                            : undefined
                                    }
                                />
                            </Center>
                        </Center>
                    </Tooltip>
                </Center>
            </PopoverTrigger>
            <Portal>
                <PopoverContent width="200px">
                    <PopoverArrow />
                    <PopoverBody p={0}>
                        <Box py={2}>
                            <MenuOption
                                icon={MdPlayArrow}
                                isDisabled={mode === DisableMode.Enabled}
                                label={t('node.enable', 'Enable')}
                                onClick={() => setMode(DisableMode.Enabled)}
                            />
                            <MenuOption
                                icon={MdPlayDisabled}
                                isDisabled={mode === DisableMode.Disabled}
                                label={t('node.disable', 'Disable')}
                                onClick={() => setMode(DisableMode.Disabled)}
                            />
                            {availableModes.includes(DisableMode.Skipped) && (
                                <MenuOption
                                    icon={IoMdFastforward}
                                    isDisabled={mode === DisableMode.Skipped}
                                    label={t('node.skip', 'Skip')}
                                    onClick={() => setMode(DisableMode.Skipped)}
                                />
                            )}
                        </Box>
                    </PopoverBody>
                </PopoverContent>
            </Portal>
        </Popover>
    );
});
