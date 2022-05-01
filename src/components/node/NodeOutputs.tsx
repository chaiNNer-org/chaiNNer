/* eslint-disable react/no-array-index-key */

import { memo } from 'react';
import { Output } from '../../common-types';
import GenericOutput from '../outputs/GenericOutput';

interface NodeOutputsProps {
  id: string;
  outputs: Output[];
}

const NodeOutputs = ({ outputs, id }: NodeOutputsProps) => (
  <>
    {outputs.map((output, i) => {
      return (
        <GenericOutput
          id={id}
          index={i}
          key={`${output.label}-${i}`}
          label={output.label}
        />
      );
    })}
  </>
);
export default memo(NodeOutputs);
