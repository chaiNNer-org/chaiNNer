import { InputData, InputSchemaValue, SchemaId } from '../../../common/common-types';

export interface InputProps {
    readonly id: string;
    readonly inputId: number;
    readonly inputData: InputData;
    readonly isLocked: boolean;
    readonly label: string;
    readonly schemaId: SchemaId;
    readonly useInputData: <T extends InputSchemaValue>(
        inputId: number
    ) => readonly [T | undefined, (value: T) => void];
}
