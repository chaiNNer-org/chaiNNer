import { Type } from '@chainner/navi';
import { OutputId, OutputKind, SchemaId } from '../../../common/common-types';

export interface UseOutputData<T> {
    /** The current output data. Current here means most recent + up to date (= same input hash). */
    readonly current: T | undefined;
    /** The most recent output data. */
    readonly last: T | undefined;
    /** Whether the most recent output data ({@link last}) is not the current output data ({@link current}). */
    readonly stale: boolean;
}

export interface OutputProps {
    readonly id: string;
    readonly outputId: OutputId;
    readonly label: string;
    readonly schemaId: SchemaId;
    readonly definitionType: Type;
    readonly hasHandle: boolean;
    readonly useOutputData: <T>(outputId: OutputId) => UseOutputData<T>;
    readonly animated: boolean;
    readonly kind: OutputKind;
}
