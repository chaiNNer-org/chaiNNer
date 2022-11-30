/* eslint-disable react/jsx-props-no-spreading */

import { Type } from '@chainner/navi';
import { memo, useCallback } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { Output, OutputId, OutputKind, SchemaId } from '../../../common/common-types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { DefaultImageOutput } from '../outputs/DefaultImageOutput';
import { GenericOutput } from '../outputs/GenericOutput';
import { LargeImageOutput } from '../outputs/LargeImageOutput';
import { NcnnModelOutput } from '../outputs/NcnnModelOutput';
import { OutputContainer } from '../outputs/OutputContainer';
import { OutputProps, UseOutputData } from '../outputs/props';
import { PyTorchOutput } from '../outputs/PyTorchOutput';

interface FullOutputProps extends Omit<Output, 'id' | 'type'>, OutputProps {
    definitionType: Type;
    index: number;
    length: number;
}

const OutputComponents: Readonly<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Record<OutputKind, React.MemoExoticComponent<(props: any) => JSX.Element>>
> = {
    image: DefaultImageOutput,
    'large-image': LargeImageOutput,
    pytorch: PyTorchOutput,
    ncnn: NcnnModelOutput,
    directory: GenericOutput,
    text: GenericOutput,
    generic: GenericOutput,
};
const OutputIsGeneric: Readonly<Record<OutputKind, boolean>> = {
    image: true,
    'large-image': false,
    pytorch: false,
    ncnn: false,
    directory: true,
    text: true,
    generic: true,
};

const pickOutput = (kind: OutputKind, props: FullOutputProps) => {
    const OutputType = OutputComponents[kind];
    return (
        <OutputContainer
            definitionType={props.definitionType}
            generic={OutputIsGeneric[kind]}
            hasHandle={props.hasHandle}
            id={props.id}
            index={props.index}
            key={`${props.id}-${props.outputId}`}
            label={props.label}
            length={props.length}
            outputId={props.outputId}
        >
            <OutputType {...props} />
        </OutputContainer>
    );
};

const NO_OUTPUT_DATA: UseOutputData<never> = { current: undefined, last: undefined, stale: false };

interface NodeOutputProps {
    outputs: readonly Output[];
    id: string;
    schemaId: SchemaId;
    animated?: boolean;
}

export const NodeOutputs = memo(({ outputs, id, schemaId, animated = false }: NodeOutputProps) => {
    const { functionDefinitions } = useContext(BackendContext);
    const outputDataEntry = useContextSelector(GlobalVolatileContext, (c) =>
        c.outputDataMap.get(id)
    );
    const inputHash = useContextSelector(GlobalVolatileContext, (c) => c.inputHashes.get(id));

    const useOutputData = useCallback(
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, func-names
        function <T>(outputId: OutputId): UseOutputData<T> {
            if (outputDataEntry) {
                const last = outputDataEntry.data?.[outputId] as T | undefined;
                if (last !== undefined) {
                    const stale = inputHash !== outputDataEntry.inputHash;
                    return { current: stale ? undefined : last, last, stale };
                }
            }
            return NO_OUTPUT_DATA;
        },
        [outputDataEntry, inputHash]
    );

    const functions = functionDefinitions.get(schemaId)!.outputDefaults;
    return (
        <>
            {outputs.map((output, index) => {
                const props: FullOutputProps = {
                    ...output,
                    id,
                    outputId: output.id,
                    useOutputData,
                    kind: output.kind,
                    schemaId,
                    definitionType: functions.get(output.id)!,
                    hasHandle: output.hasHandle,
                    animated,
                    index,
                    length: outputs.length,
                };
                return pickOutput(output.kind, props);
            })}
        </>
    );
});
