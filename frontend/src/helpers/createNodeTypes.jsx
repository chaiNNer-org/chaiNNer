/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
import React, { memo } from 'react';

import { Handle } from 'react-flow-renderer';

export const createNodeTypes = (data) => {
  const nodes = {};
  const newNode = (
    <>
      <Handle
        type="target"
        position="left"
        style={{ background: '#555' }}
        onConnect={(params) => console.log('handle onConnect', params)}
        isConnectable
      />
      <div>
        Custom Color Picker Node:
      </div>
      <input
        className="nodrag"
        type="color"
        // onChange={data.onChange}
        // defaultValue={data.color}
      />
      <Handle
        type="source"
        position="right"
        id="a"
        style={{ top: 10, background: '#555' }}
        isConnectable={false}
      />
      <Handle
        type="source"
        position="right"
        id="b"
        style={{ bottom: 10, top: 'auto', background: '#555' }}
        isConnectable
      />
    </>
  );
  nodes['ESRGAN::Run'] = newNode;
  console.log(nodes);
  return nodes;
};
