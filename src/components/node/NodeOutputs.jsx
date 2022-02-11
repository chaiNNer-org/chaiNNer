/* eslint-disable react/no-array-index-key */
/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import React, {
  memo,
} from 'react';
import GenericOutput from '../outputs/GenericOutput.jsx';

const NodeOutputs = ({ outputs, id }) => outputs.map((output, i) => {
  switch (output.type) {
    default:
      return (
        <GenericOutput key={`${output.label}-${i}`} index={i} label={output.label} id={id} />
      );
  }
});
export default memo(NodeOutputs);
