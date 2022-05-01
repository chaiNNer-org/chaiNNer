import { Center, HStack, Image, Spinner, Tag, VStack } from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useContext, useEffect, useState } from 'react';
import useFetch, { CachePolicies } from 'use-http';
import { SettingsContext } from '../../../helpers/contexts/SettingsContext';
import { checkFileExists } from '../../../helpers/util';

interface ImageObject {
  width: number;
  height: number;
  channels: number;
  image: string;
}

const getColorMode = (img: ImageObject) => {
  if (!img) {
    return '?';
  }
  switch (img.channels) {
    case 1:
      return 'GRAY';
    case 3:
      return 'RGB';
    case 4:
      return 'RGBA';
    default:
      return '?';
  }
};

interface ImagePreviewProps {
  path: string;
  category: string;
  nodeType: string;
  id: string;
}

export default memo(({ path, category, nodeType, id }: ImagePreviewProps) => {
  const [img, setImg] = useState<ImageObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);

  const [isCpu] = useIsCpu;
  const [isFp16] = useIsFp16;

  const { post, loading } = useFetch(
    `http://localhost:${port}`,
    { cachePolicy: CachePolicies.NO_CACHE },
    [port]
  );

  useEffect(() => {
    (async () => {
      if (path) {
        setIsLoading(true);
        const fileExists = await checkFileExists(path);
        if (fileExists) {
          try {
            const result = (await post('/run/individual', {
              category,
              node: nodeType,
              id,
              inputs: [path],
              isCpu,
              isFp16,
            })) as ImageObject | null;

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
    <Center w="full">
      {isLoading || loading ? (
        <Spinner />
      ) : (
        <VStack>
          <Image
            alt={
              img
                ? 'Image preview failed to load, probably unsupported file type.'
                : 'File does not exist on the system. Please select a different file.'
            }
            // boxSize="150px"
            borderRadius="md"
            draggable={false}
            maxH="200px"
            // fallbackSrc="https://via.placeholder.com/200"
            maxW="200px"
            src={(img?.image ? `data:image/png;base64,${img.image}` : undefined) || path || ''}
          />
          {img && (
            <HStack>
              <Tag>{img ? `${img.width}x${img.height}` : '?'}</Tag>
              <Tag>{getColorMode(img)}</Tag>
              <Tag>{String(path.split('.').slice(-1)).toUpperCase()}</Tag>
            </HStack>
          )}
        </VStack>
      )}
    </Center>
  );
});
