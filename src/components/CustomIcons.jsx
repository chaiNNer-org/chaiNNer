import { createIcon } from '@chakra-ui/icons';
import { Icon } from '@chakra-ui/react';
import React from 'react';

const libraries = {
  // eslint-disable-next-line global-require
  bs: require('react-icons/bs'),
};

export const NumPyIcon = createIcon({
  displayName: 'NumPyIcon',
  viewBox: '0 0 28 29.93',
  // path can also be an array of elements, if you have multiple paths, lines, shapes, etc.
  path: (
    <>
      <path
        fill="#00b5d8"
        d="M21 20.38V27l-5.88 2.93v-6.62Zm7-3.54v6.64L23 26v-6.63Zm-7.06-5.32v6.55L15.08 21v-6.57ZM28 8v6.51l-5 2.54V10.5Zm-13.81-.76 5.24 2.64L14 12.61 8.85 10ZM6.9 3.56l5 2.52-5.35 2.79-5.14-2.58Zm14.29 0 5.39 2.7-4.82 2.45-5.25-2.65ZM14 0l4.84 2.43-4.62 2.48-5-2.52Z"
      />
      <path
        fill="#3182ce"
        d="m13 14.43-4-2V21S4.21 10.74 3.77 9.82c-.06-.12-.3-.25-.36-.29L0 7.79V23l3.52 1.88v-7.96l4.83 9.3a4.28 4.28 0 0 0 1.05 1.41c.68.45 3.61 2.22 3.61 2.22Z"
      />
    </>
  ),
});

export const PyTorchIcon = createIcon({
  displayName: 'PyTorchIcon',
  viewBox: '0 0 20.97 24.99',
  // path can also be an array of elements, if you have multiple paths, lines, shapes, etc.
  path: (
    <>
      <path
        fill="#dd6b20"
        d="M17.88 7.31 16 9.17a7.61 7.61 0 0 1 0 11 7.89 7.89 0 0 1-11.11 0 7.61 7.61 0 0 1 0-11l4.9-4.84.7-.69V0l-7.4 7.29a10.24 10.24 0 0 0 0 14.71 10.53 10.53 0 0 0 14.81 0 10.25 10.25 0 0 0-.02-14.69Z"
      />
      <path
        fill="#dd6b20"
        d="M14.18 6.87a1.35 1.35 0 1 0-1.37-1.35 1.36 1.36 0 0 0 1.37 1.35Z"
      />
    </>
  ),
});

export const OpenCVIcon = createIcon({
  displayName: 'OpenCVIcon',
  viewBox: '0 0 25.98 23.88',
  // path can also be an array of elements, if you have multiple paths, lines, shapes, etc.
  path: (
    <>
      <path
        fill="#3182ce"
        d="M22.92 12.42a6.2 6.2 0 1 1-6.3 0l1.78 3a.16.16 0 0 1 0 .22 2.55 2.55 0 1 0 2.85 0 .16.16 0 0 1-.05-.22Z"
      />
      <path
        fill="#48bb78"
        d="M9.23 12.39a6.12 6.12 0 1 0 3.17 5.2H8.91a.16.16 0 0 0-.16.16 2.57 2.57 0 0 1-2.55 2.51 2.52 2.52 0 1 1 0-5 2.58 2.58 0 0 1 1 .21.16.16 0 0 0 .21-.06Z"
      />
      <path
        fill="#c53030"
        d="M9.73 11.42a6.16 6.16 0 1 1 9.35-5.28 6.09 6.09 0 0 1-3 5.28l-1.77-3a.16.16 0 0 1 .05-.22 2.55 2.55 0 1 0-2.85 0 .17.17 0 0 1 0 .22Z"
      />
    </>
  ),
});

export const IconFactoryOld = (category) => {
  switch (category) {
    case 'NumPy':
      return <NumPyIcon />;
    case 'PyTorch':
      return <PyTorchIcon />;
    case 'OpenCV':
      return <OpenCVIcon />;
    default:
      return <></>;
  }
};

export const IconFactory = (icon, accentColor) => {
  console.log('🚀 ~ file: CustomIcons.jsx ~ line 81 ~ IconFactory ~ icon', icon);
  if (!icon) {
    return <OpenCVIcon />;
  }
  // eslint-disable-next-line react/destructuring-assignment
  const prefix = icon.slice(0, 2).toLowerCase();
  const library = libraries[prefix];
  if (!library) {
    return <OpenCVIcon />;
  }
  return <Icon as={library[icon]} color={accentColor} />;
};
