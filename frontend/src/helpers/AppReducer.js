export default (state, action) => {
  switch (action.type) {
    case 'SET_STATE':
      return {
        ...state,
        ...action.payload,
        elements: action.payload.elements,
        nodeData: action.payload.nodeData,
      };
    case 'CREATE_NODE':
      return {
        ...state,
        elements: [action.payload, ...state.elements],
        nodeData: { ...state.nodeData, [action.payload.id]: {} },
      };
    case 'CREATE_EDGE':
      return {
        ...state,
        elements: [action.payload, ...state.elements],
      };
    case 'SET_ELEMENTS':
      return {
        ...state,
        elements: action.payload,
      };
    case 'SET_NODE_DATA':
      return {
        ...state,
        nodeData: action.payload,
      };
    default:
      return state;
  }
};
