/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/prop-types */
/* eslint-disable react/no-unused-state */
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

    // This is so stupid
    this.getElementById = this.getElementById.bind(this);
    this.getNodeData = this.getNodeData.bind(this);
    this.setNodeData = this.setNodeData.bind(this);
    this.pushElement = this.pushElement.bind(this);
    this.pullElementById = this.pullElementById.bind(this);
    this.pullElementByPredicate = this.pullElementByPredicate.bind(this);
    this.replaceElementById = this.replaceElementById.bind(this);
    this.createNode = this.createNode.bind(this);
    this.createEdge = this.createEdge.bind(this);
    this.deleteEdgesConnectedToHandle = this.deleteEdgesConnectedToHandle.bind(this);

    this.state = {
      elements: () => {
        const stored = sessionStorage.getItem('elements');
        if (!stored) {
          return [];
        }
        return JSON.parse(stored);
      },
      setElements: (elements) => {
        sessionStorage.setItem('elements', JSON.stringify(elements));
      },

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
    this.state.setElements([...this.state.elements, element]);
  }

  pullElement(element) {
    this.pullElementById(element.id);
  }

  pullElementById(id) {
    this.state.setElements(_.reject(this.state.elements, { id }));
  }

  pullElementByPredicate(pred) {
    this.state.setElements(_.filter(this.state.elements, (el) => !pred(el)));
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
