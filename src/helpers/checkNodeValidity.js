// TODO: This file is a monstrosity, I need to make it so inputs are done by name and not by index
const checkNodeValidity = ({ id, inputs, inputData, edges }) => {
  if (!inputs) {
    return [false, 'Node has no inputs.'];
  }
  const filteredEdges = edges.filter((e) => e.target === id);

  // Check to make sure the node has all the data it should based on the schema.
  // Compares the schema against the connections and the entered data
  const nonOptionalInputs = inputs.filter((input) => !input.optional);
  // Grabs all the indexes of the inputs that the connections are targeting
  const edgeTargetIndexes = edges
    .filter((edge) => edge.target === id)
    .map((edge) => edge.targetHandle.split('-').slice(-1)[0]);
  // Finds all empty inputs
  const emptyInputs = Object.entries(inputData)
    .filter(
      ([key, value]) =>
        !inputs[key].optional &&
        (value === '' || value === undefined || value === null) &&
        !edgeTargetIndexes.includes(String(key))
    )
    .map(([key]) => String(key));
  const enteredOptionalInputs = inputs.filter(
    (input, i) =>
      input.optional &&
      Object.keys(inputData)
        .map((index) => String(index))
        .includes(String(i)) &&
      inputData[i] !== ''
  );
  const filteredInputDataKeys = Object.entries(inputData)
    .filter(([key, value]) => !edgeTargetIndexes.includes(String(key)) && value !== '')
    .map(([key]) => key);
  const isMissingInputs =
    nonOptionalInputs.length + enteredOptionalInputs.length >
    filteredInputDataKeys.length + filteredEdges.length;
  if (isMissingInputs || emptyInputs.length > 0) {
    // Grab all inputs that do not have data or a connected edge
    const missingInputs = nonOptionalInputs.filter(
      (input, i) =>
        !edgeTargetIndexes.includes(String(i)) &&
        (!Object.keys(inputData).includes(String(i)) || emptyInputs.includes(String(i)))
    );
    return [
      false,
      `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`,
    ];
  }
  return [true, ''];
};

export default checkNodeValidity;
