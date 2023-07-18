import { NeverType, Type, evaluate } from '@chainner/navi';
import { memo, useCallback, useEffect } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { OutputId, OutputKind } from '../../../common/common-types';
import { log } from '../../../common/log';
import { getChainnerScope } from '../../../common/types/chainner-scope';
import { ExpressionJson, fromJson } from '../../../common/types/json';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { NodeState } from '../../helpers/nodeState';
import { DefaultImageOutput } from '../outputs/DefaultImageOutput';
import { GenericOutput } from '../outputs/GenericOutput';
import { LargeImageOutput } from '../outputs/LargeImageOutput';
import { OutputContainer } from '../outputs/OutputContainer';
import { OutputProps, UseOutputData } from '../outputs/props';
import { TaggedOutput } from '../outputs/TaggedOutput';

const OutputComponents: Readonly<
    Record<OutputKind, React.MemoExoticComponent<(props: OutputProps) => JSX.Element>>
> = {
    image: DefaultImageOutput,
    'large-image': LargeImageOutput,
    tagged: TaggedOutput,
    generic: GenericOutput,
};
const OutputIsGeneric: Readonly<Record<OutputKind, boolean>> = {
    image: true,
    'large-image': false,
    tagged: false,
    generic: true,
};

const NO_OUTPUT_DATA: UseOutputData<never> = { current: undefined, last: undefined, stale: false };

const evalExpression = (expression: ExpressionJson | null | undefined): Type | undefined => {
    if (expression == null) return undefined;
    try {
        return evaluate(fromJson(expression), getChainnerScope());
    } catch (error) {
        log.error(error);
    }
};

interface NodeOutputProps {
    nodeState: NodeState;
    animated: boolean;
}

export const NodeOutputs = memo(({ nodeState, animated }: NodeOutputProps) => {
    const { id, schema, schemaId, useFakeHandles } = nodeState;

    const { functionDefinitions } = useContext(BackendContext);
    const { setManualOutputType } = useContext(GlobalContext);
    const outputDataEntry = useContextSelector(GlobalVolatileContext, (c) =>
        c.outputDataMap.get(id)
    );
    const inputHash = useContextSelector(GlobalVolatileContext, (c) => c.inputHashes.get(id));
    const stale = inputHash !== outputDataEntry?.inputHash;

    const useOutputData = useCallback(
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, func-names
        function <T>(outputId: OutputId): UseOutputData<T> {
            if (outputDataEntry) {
                const last = outputDataEntry.data?.[outputId] as T | undefined;
                if (last !== undefined) {
                    return { current: stale ? undefined : last, last, stale };
                }
            }
            return NO_OUTPUT_DATA;
        },
        [outputDataEntry, stale]
    );

    const currentTypes = stale ? undefined : outputDataEntry?.types;

    useEffect(() => {
        if (isStartingNode(schema)) {
            for (const output of schema.outputs) {
                const type = evalExpression(currentTypes?.[output.id]);
                setManualOutputType(id, output.id, type);
            }
        }
    }, [id, currentTypes, schema, setManualOutputType]);

    const functions = functionDefinitions.get(schemaId)?.outputDefaults;
    return (
        <>
            {schema.outputs.map((output) => {
                const definitionType = functions?.get(output.id) ?? NeverType.instance;
                const type = nodeState.type.instance?.outputs.get(output.id);

                const OutputType = OutputComponents[output.kind];
                return (
                    <OutputContainer
                        definitionType={definitionType}
                        generic={OutputIsGeneric[output.kind]}
                        id={id}
                        isConnected={nodeState.connectedOutputs.has(output.id)}
                        key={`${id}-${output.id}`}
                        output={output}
                        type={type}
                        useFakeHandles={useFakeHandles}
                    >
                        <OutputType
                            animated={animated}
                            definitionType={definitionType}
                            id={id}
                            output={output}
                            schema={nodeState.schema}
                            type={type ?? NeverType.instance}
                            useOutputData={useOutputData}
                        />
                    </OutputContainer>
                );
            })}
        </>
    );
});
