/* eslint-disable no-nested-ternary */
import { NamedExpression, NamedExpressionField, NumericLiteralType } from '@chainner/navi';
import { ViewOffIcon } from '@chakra-ui/icons';
import { Center, HStack, Spinner, Tag, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext } from 'use-context-selector';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { OutputProps } from './props';

interface OnnxModelData {
    inNc: number;
    outNc: number;
    scale: number;
    nf: number;
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

export const OnnxModelOutput = memo(
    ({ id, outputId, useOutputData, animated = false, schemaId }: OutputProps) => {
        const [value] = useOutputData<OnnxModelData>(outputId);

        const { setManualOutputType } = useContext(GlobalContext);
        const { schemata } = useContext(BackendContext);

        const schema = schemata.get(schemaId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (value) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('OnnxModel', [
                            new NamedExpressionField('scale', new NumericLiteralType(value.scale)),
                            new NamedExpressionField(
                                'inputChannels',
                                new NumericLiteralType(value.inNc)
                            ),
                            new NamedExpressionField(
                                'outputChannels',
                                new NumericLiteralType(value.outNc)
                            ),
                            new NamedExpressionField('nf', new NumericLiteralType(value.nf)),
                        ])
                    );
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, value]);

        const tagColor = 'var(--tag-bg)';
        const fontColor = 'var(--tag-fg)';

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
                            <WrapItem>
                                <Tag
                                    bgColor={tagColor}
                                    textColor={fontColor}
                                >
                                    {value.nf}nf
                                </Tag>
                            </WrapItem>
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
