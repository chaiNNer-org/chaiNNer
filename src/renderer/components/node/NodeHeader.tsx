import {
    Center,
    HStack,
    Heading,
    LayoutProps,
    useColorModeValue,
    useToken,
} from '@chakra-ui/react';
import { memo } from 'react';
import { interpolateColor } from '../../helpers/colorTools';
import { DisabledStatus } from '../../helpers/disabled';
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

const NodeHeader = memo(
    ({ name, width, icon, accentColor, selected, parentNode, disabledStatus }: NodeHeaderProps) => {
        const [gray300, gray700] = useToken('colors', ['gray.300', 'gray.700']) as string[];
        const bgColor = useColorModeValue(gray300, gray700);
        const iconAltColor = useColorModeValue('gray.800', 'gray.200');
        const gradL = interpolateColor(accentColor, bgColor, 0.9);
        const gradR = bgColor; // interpolateColor(accentColor, bgColor, 0.95);
        return (
            <Center
                // bg={interpolateColor(accentColor, useColorModeValue('#CBD5E0', '#2D3748'), 0.875)}
                bgGradient={`linear(to-r, ${gradL}, ${gradR})`}
                borderBottomColor={accentColor}
                borderBottomStyle={parentNode ? 'double' : undefined}
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
                            accentColor={selected ? accentColor : iconAltColor}
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
                        >
                            {name.toUpperCase()}
                        </Heading>
                    </Center>
                </HStack>
            </Center>
        );
    }
);

export default NodeHeader;
