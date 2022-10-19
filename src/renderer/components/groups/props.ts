import { Group, Input, InputData, InputSize, SchemaId } from '../../../common/common-types';

export interface GroupProps<Options = Record<string, unknown>, State = never> {
    group: Group & { readonly options: Readonly<Options> };
    inputs: readonly Input[];
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    inputSize: InputSize | undefined;
    state: State | undefined;
}
