/* eslint-disable no-nested-ternary */
import { ViewOffIcon } from '@chakra-ui/icons';
import { Center, HStack, Image, Spinner, Text, useColorModeValue } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { OutputId, SchemaId } from '../../../common/common-types';
import { NamedExpression, NamedExpressionField } from '../../../common/types/expression';
import { NumericLiteralType, Type } from '../../../common/types/types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: OutputId;
    definitionType: Type;
    animated?: boolean;
    useOutputData: (outputId: OutputId) => unknown;
    schemaId: SchemaId;
}

interface LargeImageBroadcastData {
    image: string;
    width: number;
    height: number;
    channels: number;
}

export const LargeImageOutput = memo(
    ({
        label,
        id,
        outputId,
        definitionType,
        useOutputData,
        animated = false,
        schemaId,
    }: GenericOutputProps) => {
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );
        const [, setOutputDataMap] = useContextSelector(
            GlobalVolatileContext,
            (c) => c.useOutputDataMap
        );

        // useEffect(() => {
        //     setOutputDataMap((prev) => new Map([...prev, [id, {}]]));
        // }, [type]);

        const zoom = useContextSelector(GlobalVolatileContext, (c) => c.zoom);

        const value = useOutputData(outputId) as LargeImageBroadcastData | undefined;

        const { setManualOutputType, changeNodes } = useContext(GlobalContext);

        useEffect(() => {
            // TODO: Find a better way to do this that isnt hardcoding the schema id
            if (schemaId === 'chainner:image:load') {
                if (value) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('Image', [
                            new NamedExpressionField('width', new NumericLiteralType(value.width)),
                            new NamedExpressionField(
                                'height',
                                new NumericLiteralType(value.height)
                            ),
                            new NamedExpressionField(
                                'channels',
                                new NumericLiteralType(value.channels)
                            ),
                        ])
                    );
                    // setManualOutputType(
                    //     id,
                    //     1 as OutputId,
                    //     new NamedExpression('Directory', [
                    //         new NamedExpressionField(
                    //             'path',
                    //             new StringLiteralType(state.image.directory)
                    //         ),
                    //     ])
                    // );
                    // setManualOutputType(id, 2 as OutputId, new StringLiteralType(state.image.name));
                } else {
                    setManualOutputType(id, 0 as OutputId, undefined);
                    // setManualOutputType(id, 1 as OutputId, undefined);
                    // setManualOutputType(id, 2 as OutputId, undefined);
                }
            }
        }, [id, schemaId, value]);

        const imgBgColor = useColorModeValue('gray.400', 'gray.750');

        return (
            <Center
                h="full"
                minH="2rem"
                verticalAlign="middle"
                w="full"
            >
                <Center
                    h="200px"
                    w="200px"
                >
                    <Center
                        bgColor={imgBgColor}
                        borderRadius="md"
                        h="200px"
                        maxH="200px"
                        maxW="200px"
                        minH="200px"
                        minW="200px"
                        overflow="hidden"
                        w="200px"
                    >
                        {value && !animated ? (
                            <Image
                                alt="Image preview failed to load, probably unsupported file type."
                                backgroundImage={
                                    value.channels === 4
                                        ? 'data:image/webp;base64,UklGRigAAABXRUJQVlA4IBwAAAAwAQCdASoQABAACMCWJaQAA3AA/u11j//aQAAA'
                                        : ''
                                }
                                draggable={false}
                                maxH="200px"
                                maxW="200px"
                                src={value.image}
                                sx={{
                                    imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                                }}
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
                                    Image not available.
                                </Text>
                            </HStack>
                        )}
                    </Center>
                </Center>
            </Center>
        );
    }
);
