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

function ImageOutput({ data }) {
  const [img, setImg] = useState();
  const [path, setPath] = useState('');
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData, setNodeData] = useNodeData(id);

  useEffect(async () => {
    if (nodeData?.file?.path && path !== nodeData.file.path) {
      setPath(nodeData.file.path);
    }
  }, [nodeData]);

  useEffect(async () => {
    if (path) {
      const loadedImg = await ImageJS.load(path);
      setImg(loadedImg);
    }
  }, [path]);

  return (
    <OutputContainer>
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
