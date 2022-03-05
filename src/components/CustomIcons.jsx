/* eslint-disable global-require */
import { createIcon } from '@chakra-ui/icons';
import { Icon } from '@chakra-ui/react';
import React from 'react';

const libraries = {
  bs: require('react-icons/bs'),
  cg: require('react-icons/cg'),
  md: require('react-icons/md'),
  im: require('react-icons/im'),
  gi: require('react-icons/gi'),
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

// export const PyTorchIcon = createIcon({
//   displayName: 'PyTorchIcon',
//   viewBox: '0 0 20.97 24.99',
//   // path can also be an array of elements, if you have multiple paths, lines, shapes, etc.
//   path: (
//     <>
//       <path
//         fill="#dd6b20"
//         d="M17.88 7.31 16 9.17a7.61 7.61 0 0 1 0 11 7.89 7.89 0 0 1-11.11 0 7.61 7.61 0 0 1 0-11l4.9-4.84.7-.69V0l-7.4 7.29a10.24 10.24 0 0 0 0 14.71 10.53 10.53 0 0 0 14.81 0 10.25 10.25 0 0 0-.02-14.69Z"
//       />
//       <path
//         fill="#dd6b20"
//         d="M14.18 6.87a1.35 1.35 0 1 0-1.37-1.35 1.36 1.36 0 0 0 1.37 1.35Z"
//       />
//     </>
//   ),
// });

export const PyTorchIcon = createIcon({
  displayName: 'PyTorchIcon',
  viewBox: '0 0 20.97 24.99',
  // path can also be an array of elements, if you have multiple paths, lines, shapes, etc.
  path: (
    <>
      <path
        // fill="#dd6b20"
        fill="currentColor"
        d="M17.88 7.31 16 9.17a7.61 7.61 0 0 1 0 11 7.89 7.89 0 0 1-11.11 0 7.61 7.61 0 0 1 0-11l4.9-4.84.7-.69V0l-7.4 7.29a10.24 10.24 0 0 0 0 14.71 10.53 10.53 0 0 0 14.81 0 10.25 10.25 0 0 0-.02-14.69Z"
      />
      <path
        // fill="#dd6b20"
        fill="currentColor"
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

// eslint-disable-next-line no-underscore-dangle
export const _OnnxIcon = createIcon({
  displayName: 'OnnxIcon',
  viewBox: '-1.89 2.11 64 64',
  path: (
    <>
      <path
        d="M59.48 32.229c-.278.02-.504-.141-.63-.393L48.58 12.842a.804.804 0 0 1-.065-.71 2.592 2.592 0 0 0-3.969-2.95 1.057 1.057 0 0 1-.939.192l-20.194-4.05a.701.701 0 0 1-.637-.553c-.989-3.358-6.028-1.797-4.945 1.535a.876.876 0 0 1-.136.866L1.67 30.16c-.216.312-.427.445-.747.327a2.586 2.586 0 0 0-2.784 2.225 2.542 2.542 0 0 0 2.21 2.922c.315.01.584.232.655.541l8.624 21.242c.101.226.121.488.05.755-.742 2.428 2.09 4.366 4.083 2.793a.906.906 0 0 1 .697-.204l25.986 2.537a.68.68 0 0 1 .66.453c1.479 3.383 6.505.78 4.592-2.383a.643.643 0 0 1-.007-.745l13.112-22.764a.705.705 0 0 1 .687-.426c3.504.04 3.524-5.234-.007-5.184zm-40.126-20.52.735-3.17c.06-.267.144-.428.488-.449a2.235 2.235 0 0 0 1.654-.863c.161-.251.458-.317.717-.216l20.298 4.052c.055.01.108.038.315.116l-6.388 2.768-19.26 8.388a13.263 13.263 0 0 1-.295.124c-.207.083-.403.277-.64.075-.221-.189-.057-.395-.012-.589l2.39-10.263zm-1.46-1.776.106.07-2.73 11.688a.67.67 0 0 1-.504.559 2.441 2.441 0 0 0-1.784 2.19.723.723 0 0 1-.353.629L3.977 30.16a1.08 1.08 0 0 1-.217.05zm-6.832 45.604a7.344 7.344 0 0 1-.126.503L2.648 35.66a.88.88 0 0 1 .136-1.078 1.938 1.938 0 0 0 .48-1.485.742.742 0 0 1 .461-.795l9.476-5.587c.176-.106.352-.348.614-.101.234.221.554.327.496.79l-.851 7.306-2.401 20.844zm2.962 1.61a1.963 1.963 0 0 0-1-.662c-.233-.075-.392-.168-.314-.39l.742-6.478 1.485-12.9 1.027-9.026c.063-.596.504-.579.856-.798s.468.108.63.252l21.497 18.674a1.002 1.002 0 0 1-.264 1.586l-23.96 9.886c-.284.118-.478.15-.704-.141zm28.05 3.398a1.103 1.103 0 0 0-.48.413c-.331.697-.905.611-1.51.553L15.21 59.058l-.04-.116 3.86-1.606 20.185-8.33c.378-.159.614-.02.967.1 1.006.353 1.026 1.133 1.117 1.956l1.012 8.892c.03.251.025.445-.24.583zm-.857-16.374c-.04.317-.188.408-.44.523s-.559.058-.735-.16l-5.164-4.493-16.37-14.23a1.787 1.787 0 0 1-.437-1.573c.11-.226.385-.252.594-.342l24.833-10.82c.362-.163.644-.251.923.136a1.208 1.208 0 0 0 .521.36c.244.1.345.232.29.395l-.72 5.487-3.267 24.722zm2.824 15.818-.402-3.282-.725-6.292c-.07-.579-.119-1.057.493-1.51a2.215 2.215 0 0 0 .826-2.172c-.026-.24-.02-.39.193-.536l12.159-8.28c.063-.02.126-.036.189-.046zM57.25 33.588a1.888 1.888 0 0 0-.307 1.465.68.68 0 0 1-.355.78L43.556 44.76c-.144.1-.262.282-.504.146-.264-.151-.168-.368-.143-.561l3.956-29.92c.03-.221.08-.438.151-.805l2.353 4.321 7.87 14.555c.26.314.267.77.015 1.092z"
        fill="#DD6B20"
      />
      <path
        d="M45.204 13.965c.055-.161-.045-.297-.29-.396a1.208 1.208 0 0 1-.52-.36c-.277-.384-.562-.301-.924-.135l-3.86 1.686-20.945 9.128c-.207.09-.484.111-.594.34a1.79 1.79 0 0 0 .438 1.573l21.533 18.725a.596.596 0 0 0 .735.16c.252-.115.403-.2.44-.523l1.641-12.422q.816-6.149 1.624-12.3l.72-5.486z"
        fill="#fefefe"
      />
      <path
        d="M38.952 45.814Q28.206 36.477 17.454 27.14c-.166-.144-.302-.473-.63-.252s-.79.202-.855.798l-1.027 9.025-1.485 12.901-.742 6.478c-.08.222.08.317.315.39a1.966 1.966 0 0 1 .999.662c.221.292.415.257.704.141q11.98-4.948 23.96-9.883a1 1 0 0 0 .264-1.583z"
        fill="#f4f5f6"
      />
      <path
        d="m49.362 17.941-2.353-4.321-.151.805-1.334 10.208-2.618 19.712c-.025.193-.12.412.144.56.241.137.357-.05.503-.145l13.032-8.927a.68.68 0 0 0 .355-.78 1.885 1.885 0 0 1 .307-1.465.87.87 0 0 0-.015-1.092q-3.952-7.274-7.87-14.555z"
        fill="#dedfdf"
      />
      <path
        d="M16.976 22.56c.239.2.433.007.642-.076l.294-.126q9.632-4.193 19.261-8.388l6.388-2.769-.315-.116q-10.15-2.026-20.3-4.057a.612.612 0 0 0-.718.217 2.227 2.227 0 0 1-1.653.863c-.347.025-.428.181-.488.448q-.363 1.586-.735 3.171L16.96 21.991c-.045.193-.21.402.012.588zm24.327 28.507c-.09-.823-.113-1.606-1.117-1.956-.353-.126-.587-.261-.967-.1q-10.087 4.177-20.184 8.305l-3.861 1.606.04.115 24.876 2.454c.604.06 1.175.146 1.51-.553a1.095 1.095 0 0 1 .476-.413c.264-.141.269-.327.239-.584a1365.764 1365.764 0 0 1-1.012-8.892z"
        fill="#d1d1d1"
      />
      <path
        d="M14.316 27.381c.058-.465-.265-.568-.496-.79-.257-.246-.436-.005-.614.1L3.73 32.28a.742.742 0 0 0-.46.795 1.935 1.935 0 0 1-.481 1.485.883.883 0 0 0-.136 1.077q2.7 6.594 5.368 13.196l2.92 7.188a4.918 4.918 0 0 0 .126-.478q.594-5.114 1.182-10.231.612-5.305 1.219-10.613l.85-7.306z"
        fill="#d8d8d8"
      />
      <path
        d="M44.434 46.222c-.217.151-.222.297-.194.536a2.217 2.217 0 0 1-.825 2.17c-.612.427-.564.906-.494 1.51l.725 6.292.403 3.281L56.784 37.89a1.266 1.266 0 0 0-.19.045q-6.075 4.158-12.15 8.31zM12.622 25.061a.72.72 0 0 0 .355-.63 2.444 2.444 0 0 1 1.784-2.189.667.667 0 0 0 .506-.558q1.36-5.844 2.73-11.688l-.105-.07L3.752 30.2a1.195 1.195 0 0 0 .217-.048q4.324-2.547 8.653-5.091z"
        fill="#b2b2b2"
      />
    </>
  ),
});

export const OnnxIcon = createIcon({
  displayName: 'OnnxIcon',
  viewBox: '-1.89 2.11 64 64',
  path: (
    <>
      <path
        d="M59.48 32.229c-.278.02-.504-.141-.63-.393L48.58 12.842a.804.804 0 0 1-.065-.71 2.592 2.592 0 0 0-3.969-2.95 1.057 1.057 0 0 1-.939.192l-20.194-4.05a.701.701 0 0 1-.637-.553c-.989-3.358-6.028-1.797-4.945 1.535a.876.876 0 0 1-.136.866L1.67 30.16c-.216.312-.427.445-.747.327a2.586 2.586 0 0 0-2.784 2.225 2.542 2.542 0 0 0 2.21 2.922c.315.01.584.232.655.541l8.624 21.242c.101.226.121.488.05.755-.742 2.428 2.09 4.366 4.083 2.793a.906.906 0 0 1 .697-.204l25.986 2.537a.68.68 0 0 1 .66.453c1.479 3.383 6.505.78 4.592-2.383a.643.643 0 0 1-.007-.745l13.112-22.764a.705.705 0 0 1 .687-.426c3.504.04 3.524-5.234-.007-5.184zm-40.126-20.52.735-3.17c.06-.267.144-.428.488-.449a2.235 2.235 0 0 0 1.654-.863c.161-.251.458-.317.717-.216l20.298 4.052c.055.01.108.038.315.116l-6.388 2.768-19.26 8.388a13.263 13.263 0 0 1-.295.124c-.207.083-.403.277-.64.075-.221-.189-.057-.395-.012-.589l2.39-10.263zm-1.46-1.776.106.07-2.73 11.688a.67.67 0 0 1-.504.559 2.441 2.441 0 0 0-1.784 2.19.723.723 0 0 1-.353.629L3.977 30.16a1.08 1.08 0 0 1-.217.05zm-6.832 45.604a7.344 7.344 0 0 1-.126.503L2.648 35.66a.88.88 0 0 1 .136-1.078 1.938 1.938 0 0 0 .48-1.485.742.742 0 0 1 .461-.795l9.476-5.587c.176-.106.352-.348.614-.101.234.221.554.327.496.79l-.851 7.306-2.401 20.844zm2.962 1.61a1.963 1.963 0 0 0-1-.662c-.233-.075-.392-.168-.314-.39l.742-6.478 1.485-12.9 1.027-9.026c.063-.596.504-.579.856-.798s.468.108.63.252l21.497 18.674a1.002 1.002 0 0 1-.264 1.586l-23.96 9.886c-.284.118-.478.15-.704-.141zm28.05 3.398a1.103 1.103 0 0 0-.48.413c-.331.697-.905.611-1.51.553L15.21 59.058l-.04-.116 3.86-1.606 20.185-8.33c.378-.159.614-.02.967.1 1.006.353 1.026 1.133 1.117 1.956l1.012 8.892c.03.251.025.445-.24.583zm-.857-16.374c-.04.317-.188.408-.44.523s-.559.058-.735-.16l-5.164-4.493-16.37-14.23a1.787 1.787 0 0 1-.437-1.573c.11-.226.385-.252.594-.342l24.833-10.82c.362-.163.644-.251.923.136a1.208 1.208 0 0 0 .521.36c.244.1.345.232.29.395l-.72 5.487-3.267 24.722zm2.824 15.818-.402-3.282-.725-6.292c-.07-.579-.119-1.057.493-1.51a2.215 2.215 0 0 0 .826-2.172c-.026-.24-.02-.39.193-.536l12.159-8.28c.063-.02.126-.036.189-.046zM57.25 33.588a1.888 1.888 0 0 0-.307 1.465.68.68 0 0 1-.355.78L43.556 44.76c-.144.1-.262.282-.504.146-.264-.151-.168-.368-.143-.561l3.956-29.92c.03-.221.08-.438.151-.805l2.353 4.321 7.87 14.555c.26.314.267.77.015 1.092z"
        fill="currentColor"
      />
    </>
  ),
});

export const NcnnIcon = createIcon({
  displayName: 'NcnnIcon',
  viewBox: '0 0 69.39 70.13',
  path: (
    <path
      d="M69.19 69.28c-1.89.24-3.7.37-5.46.73-1.41.29-1.85-.38-2-1.53-.32-3.2-.51-6.41-.93-9.6a97.74 97.74 0 0 0-1.65-9.8c-.48-2.09-1.28-2.47-3.33-2.38a9.4 9.4 0 0 0-3.55.48 4.05 4.05 0 0 0-1.65 2.33c-1.05 3.29-1.95 6.64-2.86 10-.51 1.86-.93 3.74-1.37 5.61-.2.83-.61 1.11-1.5 1-1.69-.26-3.4-.44-5.11-.54-.9 0-1.22-.39-1.23-1.26 0-2.37-.2-4.73-.18-7.1 0-3.8.08-7.62.28-11.42a8.8 8.8 0 0 1 1.22-2.69l1.24 2.39.79-1.28a9 9 0 0 0 .3 1.39c.13.32.39.82.58.82a1.81 1.81 0 0 0 1.06-.52 3.39 3.39 0 0 0 .5-.92 9.71 9.71 0 0 1 7.21-5.37 17.79 17.79 0 0 1 8.08 0 9.65 9.65 0 0 1 6.85 6.74 55.09 55.09 0 0 1 1.79 9c.38 2.74.39 5.53.62 8.3.1 1.16.45 2.3.55 3.46a13.42 13.42 0 0 1-.25 2.16ZM9.38 29.56c-2.63.1-5.09.19-7.55.3-.81 0-1-.37-1-1-.13-2-.38-4-.45-6Q.14 15.72.05 8.59a12.86 12.86 0 0 1 .38-3.61 9.13 9.13 0 0 1 1.46-2.22l1.3 2.43.88-1.35.45 1.47c1.65-1.12 3.18-2.7 5.07-3.35C13.44.63 17.53-.8 21.66.59a10.57 10.57 0 0 1 6.71 6.19c1.79 4.64 2.08 9.53 2.45 14.4.21 2.71.26 5.43.39 8.15 0 .87-.19 1.17-1.29 1.1a30.19 30.19 0 0 0-5.62.23c-1.27.16-1.65-.37-1.74-1.32-.2-2.23-.27-4.47-.55-6.69-.5-4.1-1.05-8.19-1.69-12.27-.25-1.61-1.4-2.2-3-1.89a15.82 15.82 0 0 1-2.48.28 3.21 3.21 0 0 0-3.19 2.67c-.52 5.5-1.2 11-1.83 16.47a15.67 15.67 0 0 1-.44 1.65ZM33.62 67.85a18.7 18.7 0 0 1-2.77 1 22.9 22.9 0 0 1-4.42.53c-.36 0-.94-1-1-1.61-.33-2.32-.42-4.68-.76-7-.47-3.18-1.06-6.35-1.67-9.51-.09-.43-.59-.81-.95-1.16s-.64-.4-.92-.63c-.43-.36-.86-1.11-1.23-1.08a10.3 10.3 0 0 0-2.64.81c-.26.09-.44.4-.7.47-3 .87-3.6 3.36-4 6-.6 4.27-1.23 8.54-1.8 12.81-.17 1.27-.71 1.75-2 1.59a34.33 34.33 0 0 0-4.76-.2c-1.21 0-1.49-.66-1.6-1.64-.43-3.81-.89-7.62-1.33-11.43-.35-3-.72-6-1-9.07a12.66 12.66 0 0 1 .22-2.44l.45-.13 2 1.92v-1.7l3.19 3.61c2.35-4.45 6.36-6.75 10.91-8.36a8.35 8.35 0 0 1 7.78 1 28.46 28.46 0 0 1 4.19 3.48 11.62 11.62 0 0 1 2.95 6.7c.66 4.23 1.09 8.49 1.61 12.73.03 1.28.16 2.49.25 3.31ZM63.19 2.39l-3 .22 1 .59a2 2 0 0 1-.08.22c-1.68-.2-2.45 1.21-3.81 1.59-3.77 1.06-5.94 3.42-7.61 6.46a25 25 0 0 0-2.38 7.11 1.92 1.92 0 0 0 1.33 2.55c1.68.6 3.28 1.35 5 1.89 2 .64 4 .8 5.88-.47a4.24 4.24 0 0 1 1.05-.4c2-.66 2.22-.58 2.93 1.1.53 1.24 1 2.5 1.57 3.7.46.93-.09 1.42-.88 1.8a17.92 17.92 0 0 1-11.91 1.49 25.45 25.45 0 0 1-9.53-4 8.15 8.15 0 0 1-3.57-8 24 24 0 0 1 6.44-13.49C49.53.41 56.53-.91 61.62.59c1.29.38 1.31.45 1.57 1.8Z"
      // fill="#ED64A6"
      fill="currentColor"
    />
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
  if (!icon) {
    return <OpenCVIcon />;
  }
  switch (icon) {
    case 'NumPy':
      return <NumPyIcon color={accentColor} transition="0.15s ease-in-out" />;
    case 'PyTorch':
      return <PyTorchIcon color={accentColor} transition="0.15s ease-in-out" />;
    case 'Image':
      // return <OpenCVIcon color={accentColor} transition="0.15s ease-in-out" />;
      return <Icon as={libraries.bs.BsImageFill} color={accentColor} alignContent="center" alignItems="center" boxSize={4} viewBox="0 0 4 4" transition="0.15s ease-in-out" />;
    case 'Image (Utility)':
      return <Icon as={libraries.md.MdCrop} color={accentColor} alignContent="center" alignItems="center" boxSize={4} viewBox="0 0 4 4" transition="0.15s ease-in-out" />;
    case 'Image (Effect)':
      return <Icon as={libraries.bs.BsSliders} color={accentColor} alignContent="center" alignItems="center" boxSize={4} viewBox="0 0 4 4" transition="0.15s ease-in-out" />;
    case 'ONNX':
      return <OnnxIcon color={accentColor} transition="0.15s ease-in-out" />;
    case 'NCNN':
      return <NcnnIcon color={accentColor} transition="0.15s ease-in-out" />;
    case 'Utility':
      return <Icon as={libraries.bs.BsGearWideConnected} color={accentColor} alignContent="center" alignItems="center" boxSize={4} viewBox="0 0 4 4" transition="0.15s ease-in-out" />;
    default:
      // nothing
  }
  // eslint-disable-next-line react/destructuring-assignment
  const prefix = icon.slice(0, 2).toLowerCase();
  const library = libraries[prefix];
  if (!library) {
    return <OpenCVIcon />;
  }
  const libraryIcon = library[icon];
  return <Icon as={libraryIcon} color={accentColor} alignContent="center" alignItems="center" viewBox="0 0 4 4" width={4} height={4} transition="0.15s ease-in-out" />;
};

// color={shadeColor(accentColor, 100)}
