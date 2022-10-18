import { Type } from '@chainner/navi';
import { Input, InputKind, Size } from '../../../common/common-types';

export interface InputProps<Kind extends InputKind, Value extends string | number = never> {
    readonly value: Value | undefined;
    readonly setValue: (input: Value) => void;
    readonly resetValue: () => void;
    readonly input: Omit<Input & { readonly kind: Kind }, 'id' | 'type' | 'conversion'>;
    readonly definitionType: Type;
    readonly isLocked: boolean;
    readonly inputKey: string;
    readonly useInputLocked: () => boolean;
    readonly useInputType: () => Type;
    readonly useInputSize: () => readonly [
        Readonly<Size> | undefined,
        (size: Readonly<Size>) => void
    ];
}
