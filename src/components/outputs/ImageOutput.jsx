//
// // import {
//   memo, useContext, useEffect, useState,
// } from 'react';
// import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';
// import GenericOutput from './GenericOutput';
// import OutputContainer from './OutputContainer';

// const { Image: ImageJS } = require('image-js');

// const ImageOutput = memo(({ label, data, index }) => {
//   const [img, setImg] = useState();
//   const [path, setPath] = useState('');
//   const { id } = data;
//   const { useNodeData } = useContext(GlobalContext);
//   const [nodeData] = useNodeData(id);

//   // No preview if no shared file selected
//   // This prevents nodes that output an image but do not select any file from showing a preview
//   if (!nodeData?.sharedData?.file) {
//     return (<GenericOutput label={label} data={data} index={index} />);
//   }

//   return (
//     <OutputContainer hasHandle index={index} id={id} />
//   );
// });

// export default ImageOutput;
