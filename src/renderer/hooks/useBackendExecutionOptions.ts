import { useContext } from 'use-context-selector';
import { BackendExecutionOptions } from '../../common/Backend';
import { SettingsContext } from '../contexts/SettingsContext';

export const useBackendExecutionOptions = (): BackendExecutionOptions => {
    const { useBackendSettings } = useContext(SettingsContext);

    const [backendSettings] = useBackendSettings;

    return backendSettings;
};
