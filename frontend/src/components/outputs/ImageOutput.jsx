/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, HStack, Image, Tag, VStack,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
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

function ImageOutput({ path }) {
  const [img, setImg] = useState();

  useEffect(async () => {
    const loadedImg = await ImageJS.load(path);
    setImg(loadedImg);
  }, []);

  return (
    <OutputContainer>
      <Center
        w="full"
      >
        <VStack>
          <Image
            borderRadius="md"
            boxSize="150px"
            src={path}
            fallbackSrc="https://via.placeholder.com/150"
            alt="Image Output"
            draggable={false}
          />
          <HStack>
            <Tag>
              {img ? `${img.width}x${img.height}` : '?'}
            </Tag>
            <Tag>
              {getColorMode(img)}
            </Tag>
            <Tag>{String(path.split('.').slice(-1)).toUpperCase()}</Tag>
          </HStack>
        </VStack>
      </Center>

    </OutputContainer>
  );
}

export default ImageOutput;
