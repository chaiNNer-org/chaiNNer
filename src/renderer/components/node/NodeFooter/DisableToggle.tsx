import { Center, Icon, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { MdPlayArrow, MdPlayDisabled } from 'react-icons/md';
import { UseDisabled } from '../../../hooks/useDisabled';

interface DisableToggleProps {
    useDisable: UseDisabled;
}

export const DisableToggle = memo(({ useDisable }: DisableToggleProps) => {
    const { isDirectlyDisabled, toggleDirectlyDisabled } = useDisable;

    return (
        <Tooltip
            hasArrow
            borderRadius={8}
            gutter={24}
            label={
                isDirectlyDisabled
                    ? 'Click to enable this node.'
                    : 'Click to disable this node from executing.'
            }
            openDelay={500}
            px={2}
            textAlign="center"
        >
            <Center>
                <Center
                    className="nodrag"
                    onClick={toggleDirectlyDisabled}
                >
                    <Center
                        bgColor="var(--node-disable-bg)"
                        borderRadius="lg"
                        cursor="pointer"
                        h="1rem"
                        p="1px"
                        verticalAlign="middle"
                        w={7}
                    >
                        <Center
                            bgColor="var(--node-disable-fg)"
                            borderRadius="100%"
                            cursor="pointer"
                            h="auto"
                            ml={isDirectlyDisabled ? 0 : '48%'}
                            mr={isDirectlyDisabled ? '48%' : 0}
                            transition="all 0.1s ease-in-out"
                            w="auto"
                        >
                            <Icon
                                as={isDirectlyDisabled ? MdPlayDisabled : MdPlayArrow}
                                boxSize="0.9rem"
                                color="var(--node-disable-bg)"
                            />
                        </Center>
                    </Center>
                </Center>
            </Center>
        </Tooltip>
    );
});
