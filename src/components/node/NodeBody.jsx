/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Center, Text,
} from '@chakra-ui/react';
import React, {
  memo,
} from 'react';
import NodeInputs from './NodeInputs.jsx';
import NodeOutputs from './NodeOutputs.jsx';
// useContext, useEffect, useMemo,

const NodeBody = ({ data, accentColor }) => (
  <>
    {data.inputs.length && (
    <Center>
      <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
        INPUTS
      </Text>
    </Center>
    )}
    <NodeInputs data={data} accentColor={accentColor} />

    {data.outputs.length > 0 && (
    <Center>
      <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
        OUTPUTS
      </Text>
    </Center>
    )}
    <NodeOutputs data={data} accentColor={accentColor} />
  </>
);

export default memo(NodeBody);
