import {
    InputData,
    InputId,
    InputSchemaValue,
    InputSize,
    SchemaId,
    Size,
} from '../../../common/common-types';
import { Type } from '../../../common/types/types';

export interface InputProps {
    readonly id: string;
    readonly inputId: InputId;
    readonly inputData: InputData;
    readonly inputSize?: InputSize;
    readonly isLocked: boolean;
    readonly label: string;
    readonly schemaId: SchemaId;
    readonly optional: boolean;
    readonly definitionType: Type;
    readonly hasHandle: boolean;
    readonly useInputData: <T extends InputSchemaValue>(
        inputId: InputId
    ) => readonly [T | undefined, (value: T) => void, () => void];
    readonly useInputSize: (
        inputId: InputId
    ) => readonly [Readonly<Size> | undefined, (size: Readonly<Size>) => void];
}
