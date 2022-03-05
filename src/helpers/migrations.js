/* eslint-disable import/prefer-default-export */
import { isNode } from 'react-flow-renderer';
import semver from 'semver';

// ==============
//   pre-alpha
// ==============

const preAlpha = (data) => {
  const newData = { ...data };
  const newElements = newData.elements.map((element) => {
    const newElement = { ...element };
    if (newElement.type === 'ESRGAN::Load') {
      newElement.type = 'Model::AutoLoad';
      newElement.data.type = 'Model::AutoLoad';
    } else if (newElement.type === 'ESRGAN::Run') {
      newElement.type = 'Image::Upscale';
      newElement.data.type = 'Image::Upscale';
    }
    return newElement;
  });
  newData.elements = newElements;
  return newData;
};

// ==============
//    v3.0.0
// ==============

const v3TypeMap = {
  'Adjust::Blur': ['Image (Effect)', 'Blur'],
  'Adjust::Brightness': ['Image (Effect)', 'Brightness & Contrast'],
  'Adjust::Contrast': ['Image (Effect)', 'Brightness & Contrast'],
  'Adjust::Shift': ['Image (Effect)', 'Shift'],
  'Border::Make': ['Image (Utility)', 'Create Border'],
  'Color::Convert': ['Image (Utility)', 'Change Colorspace'],
  'Concat::Horizontal': ['Image (Utility)', 'Stack Images (Horizontal)'],
  'Concat::Vertical': ['Image (Utility)', 'Stack Images (Vertical)'],
  'Image::Read': ['Image', 'Load Image'],
  'Image::Show': ['Image', 'Preview Image'],
  'Image::Write': ['Image', 'Save Image'],
  'Resize::Factor': ['Image (Utility)', 'Resize (Factor)'],
  'Resize::Resolution': ['Image (Utility)', 'Resize (Resolution)'],
  'Threshold::Adaptive': ['Image (Effect)', 'Threshold (Adaptive)'],
  'Threshold::Standard': ['Image (Effect)', 'Threshold'],
  'Crop::Border': ['Image (Utility)', 'Crop (Border)'],
  'Crop::Offsets': ['Image (Utility)', 'Crop (Offsets)'],
  'Img::Channel::Merge': ['Image (Utility)', 'Merge Channels'],
  'Img::Channel::Split': ['Image (Utility)', 'Split Channels'],
  'Image::Upscale': ['PyTorch', 'Upscale Image'],
  'Model::AutoLoad': ['PyTorch', 'Load Model'],
  'Model::Interpolate': ['PyTorch', 'Interpolate Models'],
  'Model::Read': ['PyTorch', 'Load Model'],
  'Model::Save': ['PyTorch', 'Save Model'],
};

const toV3 = (data) => {
  const newData = { ...data };
  let newElements = [...newData.elements];
  newElements.forEach((element) => {
    if (isNode(element)) {
      if (['Model::Read', 'Model::Interpolate'].includes(element.data.type)) {
        // Find any connections coming out of a Model::Read
        const edges = newData.elements.filter((e) => e.source === element.id);
        if (edges) {
          edges.forEach((edge) => {
            // Find the targets of each connection
            const target = newElements.find((n) => n.id === edge.target);
            if (target.data.type === 'Model::AutoLoad') {
              // If target is an AutoLoad node, get the outgoing connections of it
              const targetEdges = newElements.filter((e) => e.source === target.id);
              // For each of the outgoing connections, replace the source with second output of the
              // new Load Model node
              targetEdges.forEach((targetEdge) => {
                // eslint-disable-next-line no-param-reassign
                targetEdge.source = element.id;
                // eslint-disable-next-line no-param-reassign
                targetEdge.sourceHandle = `${element.id}-1`;
              });
            }
          });
        }
      }
    }
  });
  newElements = newElements.filter((element) => !['Model::AutoLoad'].includes(element.data.type)).map((element) => {
    if (isNode(element)) {
      const newElement = { ...element };
      newElement.type = 'regularNode';
      delete newElement.data.inputs;
      delete newElement.data.outputs;
      // Nobody should have these two things but me
      delete newElement.data.icon;
      delete newElement.data.subcategory;
      // Move the contrast data to a B&C node at the right index
      if (newElement.data.type === 'Adjust::Contrast') {
        // eslint-disable-next-line prefer-destructuring
        newElement.data.inputData[1] = newElement.data.inputData[0];
        delete newElement.data.inputData[0];
      }
      // console.log({ newElement });
      const [newCategory, newType] = v3TypeMap[newElement.data.type];
      newElement.data.type = newType;
      newElement.data.category = newCategory;
      return newElement;
    }
    return element;
  });
  newData.elements = newElements;
  return newData;
};

// ==============

export const migrate = (version, data) => {
  let convertedData = data;

  // Legacy files
  if (!version || semver.lt(version, '0.1.0')) {
    convertedData = preAlpha(convertedData);
  }

  // V1&2 to V3
  if (semver.lt(version, '3.0.0')) {
    convertedData = toV3(convertedData);
  }

  return convertedData;
};
