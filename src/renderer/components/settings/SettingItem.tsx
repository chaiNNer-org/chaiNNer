import { memo, useEffect } from 'react';
import { Setting, SettingValue } from '../../../common/common-types';
import { SettingComponents } from './components';
import { SettingsProps } from './props';

interface SettingItemProps {
    setting: Setting;
    value: SettingValue | undefined;
    setValue: (value: SettingValue) => void;
}

export const SettingItem = memo(({ setting, value, setValue }: SettingItemProps) => {
    const settingIsUnset = value === undefined;
    useEffect(() => {
        if (settingIsUnset) {
            setValue(setting.default);
        }
    }, [setting, settingIsUnset, setValue]);

    if (value === undefined) {
        return null;
    }

    const Component = SettingComponents[setting.type] as (
        props: SettingsProps<Setting['type']>,
    ) => JSX.Element;

    return (
        <Component
            setValue={setValue}
            setting={setting}
            value={value}
        />
    );
});
