import log from 'electron-log';
import { memo } from 'react';
import { useContext } from 'use-context-selector';
import { checkFileExists } from '../../../common/util';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { SchemaInput } from '../inputs/SchemaInput';
import { GroupProps } from './props';

const ifExists = (file: string, then: () => void) => {
    checkFileExists(file)
        .then((exists) => {
            if (exists) {
                then();
            }
        })
        .catch((reason) => log.error(reason));
};

export const NcnnFileInputsGroup = memo(
    ({
        inputs,
        inputData,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
    }: GroupProps<'ncnn-file-inputs'>) => {
        const [paramInput, binInput] = inputs;

        const { setNodeInputValue } = useContext(GlobalContext);

        return (
            <>
                <SchemaInput
                    input={paramInput}
                    inputData={inputData}
                    inputSize={inputSize}
                    isLocked={isLocked}
                    nodeId={nodeId}
                    schemaId={schemaId}
                    onSetValue={(file) => {
                        if (typeof file === 'string') {
                            const bin = file.replace(/\.param$/i, '.bin');
                            if (bin !== file) {
                                ifExists(file, () => {
                                    setNodeInputValue(nodeId, binInput.id, bin);
                                });
                            }
                        }
                    }}
                />
                <SchemaInput
                    input={binInput}
                    inputData={inputData}
                    inputSize={inputSize}
                    isLocked={isLocked}
                    nodeId={nodeId}
                    schemaId={schemaId}
                    onSetValue={(file) => {
                        if (typeof file === 'string') {
                            const param = file.replace(/\.bin$/i, '.param');
                            if (param !== file) {
                                ifExists(file, () => {
                                    setNodeInputValue(nodeId, paramInput.id, param);
                                });
                            }
                        }
                    }}
                />
            </>
        );
    }
);
