import { Type } from '@chainner/navi';
import { OutputId, OutputKind, SchemaId } from '../../../common/common-types';

export interface OutputProps {
    readonly id: string;
    readonly outputId: OutputId;
    readonly label: string;
    readonly schemaId: SchemaId;
    readonly definitionType: Type;
    readonly hasHandle: boolean;
    readonly useOutputData: <T>(
        outputId: OutputId
    ) => readonly [value: T | undefined, inputHash: string];
    readonly animated: boolean;
    readonly kind: OutputKind;
}
