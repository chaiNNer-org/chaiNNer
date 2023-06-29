import { memo, useEffect } from 'react';
import { log } from '../../../common/log';
import { checkFileExists, getInputValue } from '../../../common/util';
import { SchemaInput } from '../inputs/SchemaInput';
import { GroupProps } from './props';

const ifExists = (file: string, then: () => void) => {
    checkFileExists(file)
        .then((exists) => {
            if (exists) {
                then();
            }
        })
        .catch(log.error);
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
        setInputValue,
        inputSize,
        isLocked,
        nodeId,
        schemaId,
    }: GroupProps<'ncnn-file-inputs'>) => {
        const [paramInput, binInput] = inputs;

        useEffect(() => {
            const paramPath = getInputValue(paramInput.id, inputData);
            const binPath = getInputValue(binInput.id, inputData);

            if (typeof paramPath === 'string' && binPath === undefined) {
                ifOtherExists(paramPath, '.bin', (bin) => setInputValue(binInput.id, bin));
            }
            if (typeof binPath === 'string' && paramPath === undefined) {
                ifOtherExists(binPath, '.param', (param) => setInputValue(paramInput.id, param));
            }
        }, [paramInput, binInput, inputData, setInputValue]);

        return (
            <>
                <SchemaInput
                    input={paramInput}
                    inputData={inputData}
                    inputSize={inputSize}
                    isLocked={isLocked}
                    nodeId={nodeId}
                    schemaId={schemaId}
                    setInputValue={(inputId, file) => {
                        setInputValue(inputId, file);

                        if (typeof file === 'string') {
                            ifOtherExists(file, '.bin', (bin) => setInputValue(binInput.id, bin));
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
                    setInputValue={(inputId, file) => {
                        setInputValue(inputId, file);

                        if (typeof file === 'string') {
                            ifOtherExists(file, '.param', (param) =>
                                setInputValue(paramInput.id, param)
                            );
                        }
                    }}
                />
            </>
        );
    }
);
