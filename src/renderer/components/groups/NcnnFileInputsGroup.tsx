import log from 'electron-log';
import { memo, useEffect } from 'react';
import { useContext } from 'use-context-selector';
import { checkFileExists, getInputValue } from '../../../common/util';
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

const ifOtherExists = (file: string, extension: string, then: (other: string) => void) => {
    const other = file.replace(/\.[a-z]+$/i, extension);
    if (other !== file) {
        ifExists(other, () => then(other));
    }
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

        useEffect(() => {
            const paramPath = getInputValue(paramInput.id, inputData);
            const binPath = getInputValue(binInput.id, inputData);

            if (typeof paramPath === 'string' && binPath === undefined) {
                ifOtherExists(paramPath, '.bin', (bin) =>
                    setNodeInputValue(nodeId, binInput.id, bin)
                );
            }
            if (typeof binPath === 'string' && paramPath === undefined) {
                ifOtherExists(binPath, '.param', (param) =>
                    setNodeInputValue(nodeId, paramInput.id, param)
                );
            }
        }, [paramInput, binInput, inputData, nodeId, setNodeInputValue]);

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
                            ifOtherExists(file, '.bin', (bin) =>
                                setNodeInputValue(nodeId, binInput.id, bin)
                            );
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
                            ifOtherExists(file, '.param', (param) =>
                                setNodeInputValue(nodeId, paramInput.id, param)
                            );
                        }
                    }}
                />
            </>
        );
    }
);
