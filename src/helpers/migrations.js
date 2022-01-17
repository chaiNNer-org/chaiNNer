/* eslint-disable import/prefer-default-export */
import semver from 'semver';

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

export const migrate = (version, data) => {
  let convertedData = data;

  // Legacy files
  if (!version || semver.lt(version, '0.1.0')) {
    convertedData = preAlpha(convertedData);
  }

  return convertedData;
};
