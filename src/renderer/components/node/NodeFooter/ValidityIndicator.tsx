import { Center, Icon, Spinner, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { BsCheck, BsExclamation } from 'react-icons/bs';
import { IoIosPause } from 'react-icons/io';
import { useContext } from 'use-context-selector';
import { Validity } from '../../../../common/Validity';
import { ExecutionStatusContext } from '../../../contexts/ExecutionContext';
import { Markdown } from '../../Markdown';

interface ValidityIndicatorProps {
    validity: Validity;
    animated: boolean;
}

export const ValidityIndicator = memo(({ validity, animated }: ValidityIndicatorProps) => {
    const { paused } = useContext(ExecutionStatusContext);

    let icon;
    let text;
    if (animated) {
        if (paused) {
            text = 'This node is currently paused';
            icon = (
                <Center
                    bgColor="var(--node-valid-bg)"
                    borderRadius={100}
                    h="auto"
                    w="auto"
                >
                    <Icon
                        as={IoIosPause}
                        boxSize="1rem"
                        color="var(--node-valid-fg)"
                        cursor="default"
                        m="auto"
                    />
                </Center>
            );
        } else {
            text = 'This node is currently running...';
            icon = <Spinner size="xs" />;
        }
    } else {
        text = validity.isValid ? 'Node valid' : validity.reason;
        icon = (
            <Center
                bgColor={validity.isValid ? 'var(--node-valid-bg)' : 'var(--node-invalid-bg)'}
                borderRadius={100}
                h="auto"
                w="auto"
            >
                <Icon
                    as={validity.isValid ? BsCheck : BsExclamation}
                    boxSize="1rem"
                    color={validity.isValid ? 'var(--node-valid-fg)' : 'var(--node-invalid-fg)'}
                    cursor="default"
                    m="auto"
                />
            </Center>
        );
    }

    return (
        <Tooltip
            hasArrow
            borderRadius={8}
            closeOnClick={false}
            gutter={24}
            label={<Markdown nonInteractive>{text}</Markdown>}
            openDelay={150}
            px={2}
            textAlign="center"
        >
            <Center className="nodrag">{icon}</Center>
        </Tooltip>
    );
});
