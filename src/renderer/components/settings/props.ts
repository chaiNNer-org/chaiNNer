import { Setting } from '../../../common/common-types';

type OfType<S, Type extends string> = S extends { type: Type } ? S : never;

export interface SettingsProps<T extends Setting['type']> {
    setting: Omit<OfType<Setting, T>, 'default' | 'type' | 'key'>;
    value: OfType<Setting, T>['default'];
    setValue: (value: OfType<Setting, T>['default']) => void;
}
