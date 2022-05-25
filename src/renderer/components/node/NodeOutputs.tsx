import { memo } from 'react';
import { Output } from '../../../common/common-types';
import GenericOutput from '../outputs/GenericOutput';

interface NodeOutputsProps {
    id: string;
    outputs: readonly Output[];
}

const NodeOutputs = memo(({ outputs, id }: NodeOutputsProps) => (
    <>
        {outputs.map((output) => {
            return (
                <GenericOutput
                    id={id}
                    key={`${output.label}-${output.id}`}
                    label={output.label}
                    outputId={output.id}
                />
            );
        })}
    </>
));

export default NodeOutputs;
