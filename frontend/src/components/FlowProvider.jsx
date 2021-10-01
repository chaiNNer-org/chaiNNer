// Based on https://github.com/Nearoo/audio-tool/blob/main/src/graph/flow.js

import _ from 'lodash';
import React, { Component } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const FlowGraphContext = React.createContext({});

function createUniqueId() {
  return uuidv4();
}

export class FlowGraphProvider extends Component {
  constructor(props) {
    super(props);
    this.state = {
      elements: [],
      setElements: (elements) => this.setState({ elements }),

      reactFlowInstance: null,
      setReactFlowInstance: (reactFlowInstance) => this.setState({ reactFlowInstance }),

      createNode: this.createNode,
      setNodeData: this.setNodeData,
      getNodeData: this.getNodeData,
      createEdge: this.createEdge,
      deleteElement: this.pullElement,
      deleteEdgesConnectedToHandle: this.deleteEdgesConnectedToHandle,
    };
  }

  getElementById(id) {
    const { elements } = this.state;
    return elements.find((element) => element.id === id);
  }

  getNodeData(id) {
    const node = this.getElementById(id);
    return node.data;
  }

  setNodeData(id, data) {
    const node = this.getElementById(id);
    this.replaceElementById(id, { ...node, data });
  }

  pushElement(element) {
    this.setState((state) => ({ elements: [...state.elements, element] }));
  }

  pullElement(element) {
    this.pullElementById(element.id);
  }

  pullElementById(id) {
    this.setState((state) => ({ elements: _.reject(state.elements, { id }) }));
  }

  pullElementByPredicate(pred) {
    this.setState((state) => ({ elements: _.filter(state.elements, (el) => !pred(el)) }));
  }

  replaceElementById(id, element) {
    this.setState((state) => (
      { elements: state.elements.map((element_) => (element_.id === id ? element : element_)) }
    ));
  }

  createNode(type, position, data = {}) {
    const id = createUniqueId();
    this.pushElement({
      type, id, position, data,
    });
  }

  createEdge(sourceNode, sourceHandle, targetNode, targetHandle, type) {
    const id = createUniqueId();
    this.pushElement({
      id, sourceHandle, targetHandle, source: sourceNode, target: targetNode, type,
    });
  }

  deleteEdgesConnectedToHandle(handleId) {
    this.pullElementByPredicate(
      (el) => el.sourceHandle === handleId || el.targetHandle === handleId,
    );
  }

  render() {
    return (
      <FlowGraphContext.Provider value={this.state}>
        {this.props.children}
      </FlowGraphContext.Provider>
    );
  }
}
