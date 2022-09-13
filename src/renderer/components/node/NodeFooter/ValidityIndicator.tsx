import { Center, Icon, Spinner, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { BsCheck, BsExclamation } from 'react-icons/bs';
import ReactMarkdown from 'react-markdown';
import { Validity } from '../../../helpers/checkNodeValidity';

interface ValidityIndicatorProps {
    validity: Validity;
    animated: boolean;
}

export const ValidityIndicator = memo(({ validity, animated }: ValidityIndicatorProps) => {
    return animated ? (
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
