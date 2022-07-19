import { memo, useCallback } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { Output, OutputId, SchemaId } from '../../../common/common-types';
import { ExecutionContext } from '../../contexts/ExecutionContext';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { GenericOutput } from '../outputs/GenericOutput';

interface NodeOutputsProps {
    id: string;
    outputs: readonly Output[];
    schemaId: SchemaId;
}

export const NodeOutputs = memo(({ outputs, id, schemaId }: NodeOutputsProps) => {
    const { functionDefinitions } = useContext(GlobalContext);
    const useOutputDataContext = useContextSelector(ExecutionContext, (c) => c.useOutputData);

    const useOutputData = useCallback(
        // eslint-disable-next-line react-hooks/rules-of-hooks
        (outputId: OutputId) => useOutputDataContext(id, outputId),
        [useOutputDataContext, id]
    );

    const functions = functionDefinitions.get(schemaId)!.outputDefaults;
    return (
        <>
            {outputs.map((output) => {
                return (
                    <GenericOutput
                        definitionType={functions.get(output.id)!}
                        id={id}
                        key={`${output.label}-${output.id}`}
                        label={output.label}
                        outputId={output.id}
                        useOutputData={useOutputData}
                    />
                );
            })}
        </>
    );
});
