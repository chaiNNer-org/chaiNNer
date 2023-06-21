import { Center, HStack, Heading, LayoutProps } from '@chakra-ui/react';
import { memo } from 'react';
import { DisabledStatus } from '../../../common/nodes/disabled';
import { interpolateColor } from '../../helpers/colorTools';
import { useThemeColor } from '../../hooks/useThemeColor';
import { IconFactory } from '../CustomIcons';

interface NodeHeaderProps {
    name: string;
    icon: string;
    accentColor: string;
    selected: boolean;
    width?: LayoutProps['width'];
    parentNode?: string;
    disabledStatus: DisabledStatus;
}

export const NodeHeader = memo(
    ({ name, width, icon, accentColor, selected, parentNode, disabledStatus }: NodeHeaderProps) => {
        const bgColor = useThemeColor('--bg-700');
        const gradL = interpolateColor(accentColor, bgColor, 0.9);
        const gradR = bgColor;
        return (
            <Center
                bgGradient={`linear(to-r, ${gradL}, ${gradR})`}
                borderBottomColor={accentColor}
                borderBottomStyle={parentNode ? 'dashed' : undefined}
                borderBottomWidth={parentNode ? '4px' : '2px'}
                h="auto"
                pt={2}
                verticalAlign="middle"
                w={width || 'full'}
            >
                <HStack
                    mb={-1}
                    mt={-1}
                    pb={2}
                    pl={6}
                    pr={6}
                    verticalAlign="middle"
                >
                    <Center
                        alignContent="center"
                        alignItems="center"
                        h={4}
                        verticalAlign="middle"
                        w={4}
                    >
                        <IconFactory
                            accentColor={selected ? accentColor : 'var(--node-icon-color)'}
                            icon={icon}
                        />
                    </Center>
                    <Center verticalAlign="middle">
                        <Heading
                            alignContent="center"
                            as="h5"
                            fontWeight={700}
                            lineHeight="auto"
                            m={0}
                            opacity={disabledStatus === DisabledStatus.Enabled ? 1 : 0.5}
                            p={0}
                            size="sm"
                            textAlign="center"
                            verticalAlign="middle"
                            whiteSpace="nowrap"
                        >
                            {name.toUpperCase()}
                        </Heading>
                    </Center>
                </HStack>
            </Center>
        );
    }
);
