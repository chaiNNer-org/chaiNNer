/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, HStack, Image, Tag, VStack,
} from '@chakra-ui/react';
import React, { useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
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

function ImageOutput({ data, index }) {
  const [img, setImg] = useState();
  const [path, setPath] = useState('');
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData] = useNodeData(id);

  useEffect(async () => {
    console.log(nodeData);
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
