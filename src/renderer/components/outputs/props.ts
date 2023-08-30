import { Type } from '@chainner/navi';
import { NodeSchema, Output, OutputId, Size } from '../../../common/common-types';

export interface UseOutputData<T> {
    /** The current output data. Current here means most recent + up to date (= same input hash). */
    readonly current: T | undefined;
    /** The most recent output data. */
    readonly last: T | undefined;
    /** Whether the most recent output data ({@link last}) is not the current output data ({@link current}). */
    readonly stale: boolean;
}

export interface OutputProps {
    readonly output: Output;
    readonly id: string;
    readonly schema: NodeSchema;
    readonly definitionType: Type;
    readonly type: Type;
    readonly useOutputData: <T>(outputId: OutputId) => UseOutputData<T>;
    readonly animated: boolean;
    readonly size: Readonly<Size> | undefined;
    readonly setSize: (size: Readonly<Size>) => void;
}
