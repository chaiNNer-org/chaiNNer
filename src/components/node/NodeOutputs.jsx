/* eslint-disable react/no-array-index-key */

import {
  memo,
} from 'react';
import GenericOutput from '../outputs/GenericOutput.jsx';

const NodeOutputs = ({ outputs, id }) => outputs.map((output, i) => {
  switch (output.type) {
    default:
      return (
        <GenericOutput
          id={id}
          index={i}
          key={`${output.label}-${i}`}
          label={output.label}
        />
      );
  }
});
export default memo(NodeOutputs);
