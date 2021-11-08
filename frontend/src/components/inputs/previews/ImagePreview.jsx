/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, HStack, Image, Tag, VStack,
} from '@chakra-ui/react';
import { Image as ImageJS } from 'image-js';
import React, { memo, useEffect, useState } from 'react';

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

export default memo(({
  path,
}) => {
  const [img, setImg] = useState(null);

  useEffect(async () => {
    if (path) {
      const loadedImg = await ImageJS.load(path);
      setImg(loadedImg);
    }
  }, [path]);

  return (
    <Center
      w="full"
    >
      <VStack>
        <Image
          borderRadius="md"
          // boxSize="150px"
          maxW="250px"
          maxH="250px"
          src={path || ''}
          // fallbackSrc="https://via.placeholder.com/150"
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
  );
});
