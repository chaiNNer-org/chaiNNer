import { memo } from 'react';
import { Output } from '../../../common/common-types';
import GenericOutput from '../outputs/GenericOutput';

interface NodeOutputsProps {
    id: string;
    outputs: readonly Output[];
    accentColor: string;
}

const NodeOutputs = memo(({ outputs, id, accentColor }: NodeOutputsProps) => (
    <>
        {outputs.map((output) => {
            return (
                <GenericOutput
                    accentColor={accentColor}
                    id={id}
                    key={`${output.label}-${output.id}`}
                    label={output.label}
                    outputId={output.id}
                    type={output.type}
                />
            );
        })}
    </>
));

export default NodeOutputs;
