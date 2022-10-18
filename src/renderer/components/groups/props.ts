import { Group, Input, InputData, InputSize, SchemaId } from '../../../common/common-types';

export interface GroupProps<Options = Record<string, unknown>> {
    group: Group & { readonly options: Readonly<Options> };
    inputs: readonly Input[];
    schemaId: SchemaId;
    nodeId: string;
    isLocked: boolean;
    inputData: InputData;
    inputSize: InputSize | undefined;
}
