/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
import React from 'react';
import Node from '../components/node/Node.jsx';
import RepresentativeNode from '../components/node/RepresentativeNode.jsx';

export const createRepresentativeNode = (category, node, subcategory) => (
  <RepresentativeNode
    category={category}
    type={node.name}
    icon={node.icon}
    subcategory={subcategory}
  />
);

export const createNodeTypes = (data) => {
  const nodesList = {
    regularNode: Node,
  };
  // if (data) {
  //   data.forEach(({ category, nodes }) => {
  //     nodes.forEach((node) => {
  //       nodesList[node.name] = Node;
  //     });
  //   });
  // }
  return nodesList;
};
