/* eslint-disable no-nested-ternary */
import { ViewOffIcon } from '@chakra-ui/icons';
import {
    Center,
    HStack,
    Spinner,
    Tag,
    Text,
    Wrap,
    WrapItem,
    useColorModeValue,
} from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext } from 'use-context-selector';
import { NamedExpression, NamedExpressionField } from '../../../common/types/expression';
import { NumericLiteralType, StringLiteralType } from '../../../common/types/types';
import { isStartingNode } from '../../../common/util';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { OutputProps } from './props';

interface PyTorchModelData {
    modelType: string;
    inNc: number;
    outNc: number;
    size: string[];
    scale: number;
}

const getColorMode = (channels: number) => {
    switch (channels) {
        case 1:
            return 'GRAY';
        case 3:
            return 'RGB';
        case 4:
            return 'RGBA';
        default:
            return channels;
    }
};

export const PyTorchOutput = memo(
    ({ id, outputId, useOutputData, animated = false, schemaId }: OutputProps) => {
        const [value] = useOutputData<PyTorchModelData>(outputId);

        const { setManualOutputType, schemata } = useContext(GlobalContext);

        const schema = schemata.get(schemaId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (value) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('PyTorchModel', [
                            new NamedExpressionField('scale', new NumericLiteralType(value.scale)),
                            new NamedExpressionField(
                                'inputChannels',
                                new NumericLiteralType(value.inNc)
                            ),
                            new NamedExpressionField(
                                'outputChannels',
                                new NumericLiteralType(value.outNc)
                            ),
                            new NamedExpressionField(
                                'modelType',
                                new StringLiteralType(value.modelType)
                            ),
                            new NamedExpressionField(
                                'size',
                                new StringLiteralType(value.size.join('x'))
                            ),
                        ])
                    );
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, value]);

        const tagColor = useColorModeValue('gray.400', 'gray.750');
        const fontColor = useColorModeValue('gray.700', 'gray.400');

        return (
            <Center
                h="full"
                minH="2rem"
                overflow="hidden"
                verticalAlign="middle"
                w="full"
            >
                {value && !animated ? (
                    <Center mt={1}>
                        <Wrap
                            justify="center"
                            maxW={60}
                            spacing={2}
                        >
                            <WrapItem>
                                <Tag
                                    bgColor={tagColor}
                                    textColor={fontColor}
                                >
                                    {value.modelType}
                                </Tag>
                            </WrapItem>
                            <WrapItem>
                                <Tag
                                    bgColor={tagColor}
                                    textColor={fontColor}
                                >
                                    {value.scale}x
                                </Tag>
                            </WrapItem>
                            <WrapItem>
                                <Tag
                                    bgColor={tagColor}
                                    textColor={fontColor}
                                >
                                    {getColorMode(value.inNc)}→{getColorMode(value.outNc)}
                                </Tag>
                            </WrapItem>
                            {value.size.map((size) => (
                                <WrapItem key={size}>
                                    <Tag
                                        bgColor={tagColor}
                                        key={size}
                                        textAlign="center"
                                        textColor={fontColor}
                                    >
                                        {size}
                                    </Tag>
                                </WrapItem>
                            ))}
                        </Wrap>
                    </Center>
                ) : animated ? (
                    <Spinner />
                ) : (
                    <HStack>
                        <ViewOffIcon />
                        <Text
                            fontSize="sm"
                            lineHeight="0.5rem"
                        >
                            Model data not available.
                        </Text>
                    </HStack>
                )}
            </Center>
        );
    }
);
