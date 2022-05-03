import { Center, Spinner, Tag, Wrap, WrapItem } from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useContext, useEffect, useState } from 'react';
import { getBackend } from '../../../helpers/Backend';
import { SettingsContext } from '../../../helpers/contexts/SettingsContext';
import { checkFileExists } from '../../../helpers/util';

interface ModelData {
  modelType: string;
  scale: number;
  inNc: number;
  outNc: number;
  size: string[];
}

const getColorMode = (channels: number) => {
  switch (channels) {
    case 1:
      return 'GRAY';
    case 3:
      return 'RGB';
    case 4:
      return 'RGBA';
    default:
      return channels;
  }
};

interface TorchModelPreviewProps {
  path: string;
  category: string;
  nodeType: string;
  id: string;
}

export default memo(({ path, category, nodeType, id }: TorchModelPreviewProps) => {
  const [modelData, setModelData] = useState<ModelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);
  const backend = getBackend(port);

  const [isCpu] = useIsCpu;
  const [isFp16] = useIsFp16;

  useEffect(() => {
    (async () => {
      if (path) {
        setIsLoading(true);
        const fileExists = await checkFileExists(path);
        if (fileExists) {
          try {
            const result = await backend.runIndividual<ModelData | null>({
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
    <Center w="full">
      {isLoading ? (
        <Spinner />
      ) : (
        modelData && (
          <Wrap
            justify="center"
            maxW={60}
            spacing={2}
          >
            <WrapItem>
              <Tag>{`${modelData.modelType ?? '?'}`}</Tag>
            </WrapItem>
            <WrapItem>
              <Tag>{`${modelData.scale ?? '?'}x`}</Tag>
            </WrapItem>
            <WrapItem>
              <Tag>
                {modelData
                  ? `${getColorMode(modelData.inNc)}→${getColorMode(modelData.outNc)}`
                  : '?'}
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
        )
      )}
    </Center>
  );
});
