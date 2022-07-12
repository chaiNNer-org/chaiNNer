import { memo } from 'react';
import { useContext } from 'use-context-selector';
import { Output, OutputData, SchemaId } from '../../../common/common-types';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { GenericOutput } from '../outputs/GenericOutput';

interface NodeOutputsProps {
    id: string;
    outputs: readonly Output[];
    schemaId: SchemaId;
    outputData: OutputData;
}

export const NodeOutputs = memo(({ outputs, id, schemaId, outputData }: NodeOutputsProps) => {
    const { functionDefinitions } = useContext(GlobalContext);
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
                        outputData={outputData}
                        outputId={output.id}
                    />
                );
            })}
        </>
    );
});
