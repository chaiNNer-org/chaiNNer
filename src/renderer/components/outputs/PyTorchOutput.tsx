/* eslint-disable no-nested-ternary */
import { NamedExpression, NamedExpressionField, literal } from '@chainner/navi';
import { ViewOffIcon } from '@chakra-ui/icons';
import { Center, HStack, Spinner, Text } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useContext } from 'use-context-selector';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { LargeTags } from './elements/LargeTags';
import { OutputProps } from './props';

interface PyTorchModelData {
    arch: string;
    inNc: number;
    outNc: number;
    size: string[];
    scale: number;
    subType: string;
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
    ({ id, outputId, useOutputData, animated, schemaId }: OutputProps) => {
        const { t } = useTranslation();

        const { current } = useOutputData<PyTorchModelData>(outputId);

        const { setManualOutputType } = useContext(GlobalContext);
        const { schemata } = useContext(BackendContext);

        const schema = schemata.get(schemaId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (current) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('PyTorchModel', [
                            new NamedExpressionField('scale', literal(current.scale)),
                            new NamedExpressionField('inputChannels', literal(current.inNc)),
                            new NamedExpressionField('outputChannels', literal(current.outNc)),
                            new NamedExpressionField('arch', literal(current.arch)),
                            new NamedExpressionField('size', literal(current.size.join('x'))),
                            new NamedExpressionField('subType', literal(current.subType)),
                        ])
                    );
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, current, outputId, schema, setManualOutputType]);

        return (
            <Center
                h="full"
                minH="2rem"
                overflow="hidden"
                verticalAlign="middle"
                w="full"
            >
                {current && !animated ? (
                    <LargeTags
                        tags={[
                            current.arch,
                            `${getColorMode(current.inNc)}→${getColorMode(current.outNc)}`,
                            ...current.size,
                        ]}
                    />
                ) : animated ? (
                    <Spinner />
                ) : (
                    <HStack>
                        <ViewOffIcon />
                        <Text
                            fontSize="sm"
                            lineHeight="0.5rem"
                        >
                            {t('outputs.model.modelNotAvailable', 'Model data not available.')}
                        </Text>
                    </HStack>
                )}
            </Center>
        );
    }
);
