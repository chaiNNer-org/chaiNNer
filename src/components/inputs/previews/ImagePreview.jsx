/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, HStack, Image, Spinner, Tag, VStack,
} from '@chakra-ui/react';
import log from 'electron-log';
import { constants } from 'fs';
import { access } from 'fs/promises';
import React, {
  memo, useContext, useEffect, useState,
} from 'react';
import useFetch from 'use-http';
import { GlobalContext } from '../../../helpers/GlobalNodeState.jsx';

const checkFileExists = (file) => new Promise((resolve) => access(file, constants.F_OK)
  .then(() => resolve(true))
  .catch(() => resolve(false)));

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
  path, category, nodeType, id,
}) => {
  const [img, setImg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { port } = useContext(GlobalContext);

  const { post, error, loading } = useFetch(`http://localhost:${port}`, {
    cachePolicy: 'no-cache',
  }, [port]);

  useEffect(() => {
    (async () => {
      if (path) {
        setIsLoading(true);
        if (await checkFileExists(path)) {
          try {
            // const loadedImg = await ImageJS.load(path);
            // setImg(loadedImg);
            const result = await post('/run/individual', {
              category,
              node: nodeType,
              id,
              inputs: [path],
            });
            if (result) {
              setImg(result);
            }
          } catch (err) {
            log.error(err);
          }
        }
        setIsLoading(false);
      }
    })();
  }, [path]);

  return (
    <Center
      w="full"
    >
      {isLoading || loading
        ? <Spinner />
        : (
          <VStack>
            <Image
              borderRadius="md"
          // boxSize="150px"
              maxW="200px"
              maxH="200px"
              src={(img.image ? `data:image/png;base64,${img.image}` : undefined) || path || ''}
              // fallbackSrc="https://via.placeholder.com/200"
              alt="Image preview failed to load, probably unsupported file type."
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
