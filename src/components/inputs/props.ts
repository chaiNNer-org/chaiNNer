import { InputData, InputSchemaValue } from '../../common-types';

export interface InputProps {
    readonly id: string;
    readonly index: number;
    readonly inputData: InputData;
    readonly isLocked: boolean;
    readonly label: string;
    readonly schemaId: string;
    readonly useInputData: <T extends InputSchemaValue>(
        index: number
    ) => readonly [T | undefined, (value: T) => void];
}
