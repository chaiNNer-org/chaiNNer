import { Center, Icon, Spinner, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { BsCheck, BsExclamation } from 'react-icons/bs';
import { IoIosPause } from 'react-icons/io';
import ReactMarkdown from 'react-markdown';
import { useContext } from 'use-context-selector';
import { Validity } from '../../../../common/Validity';
import { ExecutionStatusContext } from '../../../contexts/ExecutionContext';

interface ValidityIndicatorProps {
    validity: Validity;
    animated: boolean;
}

export const ValidityIndicator = memo(({ validity, animated }: ValidityIndicatorProps) => {
    const { paused } = useContext(ExecutionStatusContext);

    // eslint-disable-next-line no-nested-ternary
    return animated ? (
        paused ? (
            <Tooltip
                hasArrow
                borderRadius={8}
                closeOnClick={false}
                gutter={24}
                label="This node is currently paused"
                px={2}
                textAlign="center"
            >
                <Center className="nodrag">
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
                </Center>
            </Tooltip>
        ) : (
            <Tooltip
                hasArrow
                borderRadius={8}
                closeOnClick={false}
                gutter={24}
                label="This node is currently running..."
                px={2}
                textAlign="center"
            >
                <Center className="nodrag">
                    <Spinner size="xs" />
                </Center>
            </Tooltip>
        )
    ) : (
        <Tooltip
            hasArrow
            borderRadius={8}
            closeOnClick={false}
            gutter={24}
            label={
                <ReactMarkdown>{validity.isValid ? 'Node valid' : validity.reason}</ReactMarkdown>
            }
            px={2}
            textAlign="center"
        >
            <Center className="nodrag">
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
            </Center>
        </Tooltip>
    );
});
