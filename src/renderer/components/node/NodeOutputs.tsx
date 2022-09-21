/* eslint-disable react/jsx-props-no-spreading */

import { memo, useCallback } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { Output, OutputId, OutputKind, SchemaId } from '../../../common/common-types';
import { Type } from '../../../common/types/types';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { DefaultImageOutput } from '../outputs/DefaultImageOutput';
import { GenericOutput } from '../outputs/GenericOutput';
import { LargeImageOutput } from '../outputs/LargeImageOutput';
import { NcnnModelOutput } from '../outputs/NcnnModelOutput';
import { OnnxModelOutput } from '../outputs/OnnxModelOutput';
import { OutputContainer } from '../outputs/OutputContainer';
import { OutputProps } from '../outputs/props';
import { PyTorchOutput } from '../outputs/PyTorchOutput';

interface FullOutputProps extends Omit<Output, 'id' | 'type'>, OutputProps {
    definitionType: Type;
}

const OutputComponents: Readonly<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Record<OutputKind, React.MemoExoticComponent<(props: any) => JSX.Element>>
> = {
    image: DefaultImageOutput,
    'large-image': LargeImageOutput,
    pytorch: PyTorchOutput,
    onnx: OnnxModelOutput,
    ncnn: NcnnModelOutput,
    directory: GenericOutput,
    text: GenericOutput,
    generic: GenericOutput,
};
const OutputIsGeneric: Readonly<Record<OutputKind, boolean>> = {
    image: true,
    'large-image': false,
    pytorch: false,
    onnx: false,
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
            key={`${props.id}-${props.outputId}`}
            label={props.label}
            outputId={props.outputId}
        >
            <OutputType {...props} />
        </OutputContainer>
    );
};

interface NodeOutputProps {
    outputs: readonly Output[];
    id: string;
    schemaId: SchemaId;
    animated?: boolean;
}

export const NodeOutputs = memo(({ outputs, id, schemaId, animated = false }: NodeOutputProps) => {
    const { getInputHash } = useContext(GlobalContext);
    const { functionDefinitions } = useContext(BackendContext);
    const outputDataEntry = useContextSelector(GlobalVolatileContext, (c) =>
        c.outputDataMap.get(id)
    );

    const useOutputData = useCallback(
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, func-names
        function <T>(outputId: OutputId): readonly [value: T | undefined, inputHash: string] {
            if (outputDataEntry) {
                return [
                    outputDataEntry.data?.[outputId] as T | undefined,
                    outputDataEntry.inputHash,
                ];
            }
            return [undefined, getInputHash(id)];
        },
        [outputDataEntry]
    );

    const functions = functionDefinitions.get(schemaId)!.outputDefaults;
    return (
        <>
            {outputs.map((output) => {
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
                };
                return pickOutput(output.kind, props);
            })}
        </>
    );
});
