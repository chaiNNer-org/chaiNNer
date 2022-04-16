import {
  Center, Text,
} from '@chakra-ui/react';
import {
  memo,
} from 'react';
import NodeInputs from './NodeInputs.jsx';
import NodeOutputs from './NodeOutputs.jsx';
// useContext, useEffect, useMemo,

const NodeBody = ({
  accentColor, inputs, outputs, id, isLocked, category, nodeType,
}) => (
  <>
    {inputs.length && (
    <Center>
      <Text
        fontSize="xs"
        m={0}
        mb={-1}
        mt={-1}
        p={0}
        pb={-1}
        pt={-1}
      >
        INPUTS
      </Text>
    </Center>
    )}
    <NodeInputs
      accentColor={accentColor}
      category={category}
      id={id}
      inputs={inputs}
      isLocked={isLocked}
      nodeType={nodeType}
    />

    {outputs.length > 0 && (
    <Center>
      <Text
        fontSize="xs"
        m={0}
        mb={-1}
        mt={-1}
        p={0}
        pb={-1}
        pt={-1}
      >
        OUTPUTS
      </Text>
    </Center>
    )}
    <NodeOutputs
      accentColor={accentColor}
      id={id}
      outputs={outputs}
    />
  </>
);

export default memo(NodeBody);
