/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, HStack, Image, Tag, VStack,
} from '@chakra-ui/react';
import React, { useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import GenericOutput from './GenericOutput.jsx';
import OutputContainer from './OutputContainer.jsx';

const { Image: ImageJS } = require('image-js');

const getColorMode = (img) => {
  if (!img) {
    return '?';
  }
  switch (img.channels) {
    case (1):
      return 'GRAY';
    case (3):
      return 'RGB';
    case (4):
      return 'RGBA';
    default:
      return '?';
  }
};

function ImageOutput({ label, data, index }) {
  const [img, setImg] = useState();
  const [path, setPath] = useState('');
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData] = useNodeData(id);

  useEffect(async () => {
    if (nodeData?.sharedData?.file?.path && path !== nodeData.sharedData.file.path) {
      setPath(nodeData.sharedData.file.path);
    }
  }, [nodeData]);

  useEffect(async () => {
    if (path) {
      const loadedImg = await ImageJS.load(path);
      setImg(loadedImg);
    }
  }, [path]);

  // No preview if no shared file selected
  // This prevents nodes that output an image but do not select any file from showing a preview
  if (!nodeData?.sharedData?.file) {
    return (<GenericOutput label={label} data={data} index={index} />);
  }

  return (
    <OutputContainer hasHandle index={index} id={id}>
      <Center
        w="full"
      >
        <VStack>
          <Image
            borderRadius="md"
            boxSize="150px"
            src={path || ''}
            fallbackSrc="https://via.placeholder.com/150"
            alt="Image Output"
            draggable={false}
          />
          {
            img && (
              <HStack>
                <Tag>
                  {img ? `${img.width}x${img.height}` : '?'}
                </Tag>
                <Tag>
                  {getColorMode(img)}
                </Tag>
                <Tag>{String(path.split('.').slice(-1)).toUpperCase()}</Tag>
              </HStack>
            )
          }

        </VStack>
      </Center>

    </OutputContainer>
  );
}

export default ImageOutput;
