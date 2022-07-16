import { InputData, InputId, InputSchemaValue, SchemaId, Size } from '../../../common/common-types';
import { Type } from '../../../common/types/types';

export interface InputProps {
    readonly id: string;
    readonly inputId: InputId;
    readonly inputData: InputData;
    readonly inputSize: Size;
    readonly isLocked: boolean;
    readonly label: string;
    readonly schemaId: SchemaId;
    readonly optional: boolean;
    readonly definitionType: Type;
    readonly hasHandle: boolean;
    readonly useInputData: <T extends InputSchemaValue>(
        inputId: InputId
    ) => readonly [T | undefined, (value: T) => void, () => void];
    readonly useInputSize: <Size>(
        inputId: InputId
    ) => readonly [Size | undefined, (value: Size) => void, () => void];
}
