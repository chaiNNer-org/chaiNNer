import { cpu, graphics } from 'systeminformation';
import { lazy } from '../common/util';

export const getGpuInfo = lazy(() => graphics());
export const getCpuInfo = lazy(() => cpu());
