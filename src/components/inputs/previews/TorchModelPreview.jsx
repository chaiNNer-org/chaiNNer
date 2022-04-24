import {
  Center, Spinner, Tag, Wrap, WrapItem,
} from '@chakra-ui/react';
import log from 'electron-log';
import { constants } from 'fs';
import { access } from 'fs/promises';
import {
  memo, useContext, useEffect, useState,
} from 'react';
import useFetch from 'use-http';
import { SettingsContext } from '../../../helpers/contexts/SettingsContext.jsx';

const checkFileExists = (file) => new Promise((resolve) => access(file, constants.F_OK)
  .then(() => resolve(true))
  .catch(() => resolve(false)));

const getColorMode = (channels) => {
  if (!channels) {
    return '?';
  }
  switch (channels) {
    case (1):
      return 'GRAY';
    case (3):
      return 'RGB';
    case (4):
      return 'RGBA';
    default:
      return channels;
  }
};

export default memo(({
  path, category, nodeType, id,
}) => {
  const [modelData, setModelData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    useIsCpu,
    useIsFp16,
    port,
  } = useContext(SettingsContext);

  const [isCpu] = useIsCpu;
  const [isFp16] = useIsFp16;

  const { post, loading } = useFetch(`http://localhost:${port}`, {
    cachePolicy: 'no-cache',
  }, [port]);

  useEffect(() => {
    (async () => {
      if (path) {
        setIsLoading(true);
        const fileExists = await checkFileExists(path);
        if (fileExists) {
          try {
            const result = await post('/run/individual', {
              category,
              node: nodeType,
              id,
              inputs: [path],
              isCpu,
              isFp16,
            });
            if (result) {
              setModelData(result);
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
        : modelData && (
        <Wrap
          justify="center"
          maxW={60}
          spacing={2}
        >
          <WrapItem>
            <Tag>
              {`${modelData.modelType ?? '?'}`}
            </Tag>
          </WrapItem>
          <WrapItem>
            <Tag>
              {`${modelData.scale ?? '?'}x`}
            </Tag>
          </WrapItem>
          <WrapItem>
            <Tag>
              {modelData ? `${getColorMode(modelData.inNc)}→${getColorMode(modelData.outNc)}` : '?'}
            </Tag>
          </WrapItem>
          {modelData.size.map((size) => (
            <WrapItem key={size}>
              <Tag
                key={size}
                textAlign="center"
              >
                {size}
              </Tag>
            </WrapItem>
          ))}
        </Wrap>
        )}
    </Center>
  );
});
