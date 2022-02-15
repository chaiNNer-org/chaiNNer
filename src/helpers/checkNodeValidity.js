const checkNodeValidity = ({
  id, inputs, inputData, edges,
}) => {
  if (!inputs) {
    return [false, 'Node has no inputs.'];
  }
  const filteredEdges = edges.filter((e) => e.target === id);

  // Check to make sure the node has all the data it should based on the schema.
  // Compares the schema against the connections and the entered data
  const nonOptionalInputs = inputs.filter((input) => !input.optional);
  const emptyInputs = Object.entries(inputData).filter(([key, value]) => nonOptionalInputs.includes(key) && (value === '' || value === undefined || value === null)).map(([key]) => String(key));
  // eslint-disable-next-line max-len
  const isMissingInputs = nonOptionalInputs.length > Object.keys(inputData).length + filteredEdges.length;
  if (isMissingInputs || emptyInputs.length > 0) {
    // Grabs all the indexes of the inputs that the connections are targeting
    const edgeTargetIndexes = edges.filter((edge) => edge.target === id).map((edge) => edge.targetHandle.split('-').slice(-1)[0]);
    // Grab all inputs that do not have data or a connected edge
    const missingInputs = nonOptionalInputs.filter(
      (input, i) => !Object.keys(inputData).includes(String(i))
          && !edgeTargetIndexes.includes(String(i)),
    );
    // TODO: This fails to output the missing inputs when a node is connected to another
    return [false, `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`];
  }
  return [true, ''];
};

export default checkNodeValidity;
