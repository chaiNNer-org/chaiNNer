// /* eslint-disable import/extensions */
// /* eslint-disable react/prop-types */
// import React, {
//   memo, useContext, useEffect, useState,
// } from 'react';
// import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';
// import GenericOutput from './GenericOutput.jsx';
// import OutputContainer from './OutputContainer.jsx';

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
