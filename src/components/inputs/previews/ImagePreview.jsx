/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, HStack, Image, Spinner, Tag, VStack,
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (path) {
        setIsLoading(true);
        const loadedImg = await ImageJS.load(path);
        setImg(loadedImg);
        setIsLoading(false);
      }
    })();
  }, [path]);

  return (
    <Center
      w="full"
    >
      {isLoading
        ? <Spinner />
        : (
          <VStack>
            <Image
              borderRadius="md"
          // boxSize="150px"
              maxW="200px"
              maxH="200px"
              src={path || ''}
              // fallbackSrc="https://via.placeholder.com/200"
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
        )}
    </Center>
  );
});
