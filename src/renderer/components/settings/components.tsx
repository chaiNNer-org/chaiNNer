import {
    Button,
    HStack,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    Select,
    Switch,
} from '@chakra-ui/react';
import path from 'path';
import { memo, useEffect, useMemo } from 'react';
import { Setting } from '../../../common/common-types';
import { getCacheLocation } from '../../../common/env';
import { log } from '../../../common/log';
import { ipcRenderer } from '../../../renderer/safeIpc';
import { SettingsProps } from './props';
import { SettingContainer } from './SettingContainer';

export const ToggleSetting = memo(({ setting, value, setValue }: SettingsProps<'toggle'>) => {
    return (
        <SettingContainer
            description={setting.description}
            title={setting.label}
        >
            <Switch
                defaultChecked={value}
                isChecked={value}
                isDisabled={setting.disabled}
                size="lg"
                onChange={() => setValue(!value)}
            />
        </SettingContainer>
    );
});

export const DropdownSetting = memo(({ setting, value, setValue }: SettingsProps<'dropdown'>) => {
    const validValue = setting.options.some((o) => o.value === value);
    useEffect(() => {
        if (!validValue && !setting.disabled) {
            if (setting.options.length > 0) {
                setValue(setting.options[0].value);
            }
        }
    }, [validValue, setting, setValue]);

    const invalidKey = '<invalid>';
    const displayValue = validValue ? value : setting.options[0]?.value ?? invalidKey;

    return (
        <SettingContainer
            description={setting.description}
            title={setting.label}
        >
            <Select
                isDisabled={setting.disabled || setting.options.length === 0}
                minWidth={setting.small ? '171px' : '350px'}
                value={displayValue}
                onChange={(e) => {
                    const newValue = e.target.value;
                    if (setting.options.some((o) => o.value === newValue)) {
                        setValue(newValue);
                    }
                }}
            >
                {setting.options.length === 0 && (
                    <option value={invalidKey}>No options found.</option>
                )}
                {setting.options.map((o) => (
                    <option
                        key={o.value}
                        value={o.value}
                    >
                        {o.label}
                    </option>
                ))}
            </Select>
        </SettingContainer>
    );
});

export const NumberSetting = memo(({ setting, value, setValue }: SettingsProps<'number'>) => {
    return (
        <SettingContainer
            description={setting.description}
            title={setting.label}
        >
            <NumberInput
                isDisabled={setting.disabled}
                max={setting.max}
                min={setting.min}
                step={1}
                value={value}
                width="171px"
                onChange={(v) => {
                    const newValue = parseFloat(v);
                    if (!Number.isNaN(newValue)) {
                        setValue(newValue);
                    }
                }}
            >
                <NumberInputField />
                <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                </NumberInputStepper>
            </NumberInput>
        </SettingContainer>
    );
});

const CacheSetting = memo(({ setting, value, setValue }: SettingsProps<'cache'>) => {
    const locationPromise = useMemo(async () => {
        return ipcRenderer
            .invoke('get-appdata')
            .then((appDataPath) => getCacheLocation(appDataPath, setting.directory));
    }, [setting.directory]);

    return (
        <SettingContainer
            description={setting.description}
            title={setting.label}
        >
            <HStack w="full">
                <Button
                    isDisabled={setting.disabled || !value}
                    visibility={value ? 'visible' : 'hidden'}
                    onClick={() => {
                        locationPromise
                            .then(async (cacheLocation) => {
                                const files = await ipcRenderer.invoke('fs-readdir', cacheLocation);
                                await Promise.all(
                                    files.map((file) =>
                                        ipcRenderer.invoke(
                                            'fs-unlink',
                                            path.join(cacheLocation, file)
                                        )
                                    )
                                );
                            })
                            .catch(log.error);
                    }}
                >
                    Clear Cache
                </Button>

                <Switch
                    isChecked={!!value}
                    isDisabled={setting.disabled}
                    size="lg"
                    onChange={() => {
                        if (!value) {
                            // Make sure the cache directory exists
                            locationPromise
                                .then(async (cacheLocation) => {
                                    try {
                                        await ipcRenderer.invoke('fs-access', cacheLocation);
                                    } catch (error) {
                                        await ipcRenderer.invoke('fs-mkdir', cacheLocation, {
                                            recursive: true,
                                        });
                                    }
                                    setValue(cacheLocation);
                                })
                                .catch(log.error);
                        } else {
                            setValue('');
                        }
                    }}
                />
            </HStack>
        </SettingContainer>
    );
});

export const SettingComponents: {
    readonly [K in Setting['type']]: React.MemoExoticComponent<
        (props: SettingsProps<K>) => JSX.Element
    >;
} = {
    toggle: ToggleSetting,
    dropdown: DropdownSetting,
    number: NumberSetting,
    cache: CacheSetting,
};
