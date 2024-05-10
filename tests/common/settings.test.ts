import { expect, test } from 'vitest';
import { migrateOldStorageSettings } from '../../src/common/settings/migration';

const oldSettingData: Partial<Record<string, string>> = {
    'allow-multiple-instances': 'false',
    'animate-chain': 'true',
    'backend-settings':
        '{"chaiNNer_pytorch":{"gpu_index":"0","use_cpu":false,"use_fp16":false,"budget_limit":0},"chaiNNer_ncnn":{"gpu_index":"0","budget_limit":0},"chaiNNer_onnx":{"gpu_index":"0","execution_provider":"CUDAExecutionProvider","onnx_tensorrt_cache":"","tensorrt_fp16_mode":false}}',
    'check-upd-on-strtup': 'true',
    'check-upd-on-strtup-2': 'true',
    'disable-hw-accel': 'true',
    'enable-hardware-acceleration': 'false',
    'experimental-features': 'true',
    'is-cpu': 'false',
    'is-fp16': 'false',
    'ncnn-gpu': '0',
    'node-favorites':
        '["chainner:image:preview","chainner:image:save","chainner:image:average_color_fix","chainner:image:overlay","chainner:image:fill_alpha","chainner:pytorch:load_model","chainner:pytorch:upscale_image","chainner:utility:text_pattern","chainner:image:load","chainner:image:view","chainner:utility:copy_to_clipboard"]',
    'node-hidden': '[]',
    'node-selector-collapsed': 'true',
    'node-visibility-mode-active': 'true',
    'onnx-execution-provider': '"CUDAExecutionProvider"',
    'onnx-gpu': '0',
    'onnx-should-tensorrt-cache': 'false',
    'onnx-should-tensorrt-fp16': 'false',
    'pytorch-gpu': '0',
    'snap-to-grid': 'true',
    'snap-to-grid-amount': '16',
    'startup-template': '""',
    'system-python-location': '"C:\\\\python39\\\\python.exe"',
    theme: '"dark"',
    'use-dark-mode': 'true',
    'use-discord-rpc': 'true',
    'use-last-directory-chainner:image:file_iterator 0': 'C:\\DS3TexUp\\upscale',
    'use-last-directory-chainner:image:file_iterator-0':
        'C:\\Users\\micha\\Desktop\\detail n\\Neuer Ordner',
    'use-last-directory-chainner:image:load 0': 'C:\\Users\\micha\\Desktop',
    'use-last-directory-chainner:image:load-0': 'C:\\Users\\micha\\Desktop',
    'use-last-directory-chainner:image:load_images-0': 'C:\\Users\\micha\\Desktop\\Irithyll',
    'use-last-directory-chainner:image:load_image_pairs-0': 'C:\\DS3TexUp\\extract\\chr',
    'use-last-directory-chainner:image:load_image_pairs-1': 'C:\\DS3TexUp',
    'use-last-directory-chainner:image:load_video-0': 'D:\\Videos\\games',
    'use-last-directory-chainner:image:save 1': 'C:\\DS3TexUp\\up-manual-new',
    'use-last-directory-chainner:image:save-1': 'C:\\Users\\micha\\Desktop',
    'use-last-directory-chainner:image:save_video-1': 'C:\\Users\\micha\\Desktop',
    'use-last-directory-chainner:ncnn:load_model 0':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\.ncnn-models\\4x_RealSR_DF2K_JPEG',
    'use-last-directory-chainner:ncnn:load_model 1':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\.ncnn-models\\4x_RealSR_DF2K_JPEG',
    'use-last-directory-chainner:ncnn:load_model-0':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\ESRGAN',
    'use-last-directory-chainner:ncnn:load_model-1':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\ESRGAN\\realesrgan-x4plus.ncnn',
    'use-last-directory-chainner:ncnn:save_model-1':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\.ncnn-models\\4x_RealSR_DF2K_JPEG',
    'use-last-directory-chainner:onnx:load_model 0':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\ESRGAN\\onnx',
    'use-last-directory-chainner:onnx:load_model-0': 'C:\\Users\\micha\\Downloads',
    'use-last-directory-chainner:onnx:save_model 1':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\ESRGAN\\onnx',
    'use-last-directory-chainner:onnx:save_model-1': 'C:\\Users\\micha\\Desktop',
    'use-last-directory-chainner:pytorch:load_data-0':
        'C:\\Users\\micha\\Git\\model-database\\data\\models',
    'use-last-directory-chainner:pytorch:load_model 0':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\ESRGAN',
    'use-last-directory-chainner:pytorch:load_model-0': 'C:\\Users\\micha\\Downloads',
    'use-last-directory-chainner:pytorch:load_models-0': 'C:\\DS3TexUp\\extract\\m31',
    'use-last-directory-chainner:pytorch:model_file_iterator-0':
        'C:\\DS3TexUp\\Cupscale 1.39.0f1\\CupscaleData\\models\\ESRGAN',
    'use-last-directory-chainner:pytorch:save_model 1': 'C:\\Users\\micha\\Desktop',
    'use-last-directory-chainner:utility:directory-0': 'C:\\DS3TexUp\\extract\\chr',
    'use-last-window-size': '{"maximized":false,"width":1527,"height":1007}',
    'use-recently-open':
        '["C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\tile.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\sliders test.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\test.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\simple-upscale.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\normal-pattern-add.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\normal.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\key color upscale.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\asdasdsadasd.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\_resize test.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\sfx-workflow.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\gaussian research.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\ds-normal-test.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\wood.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\temp.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\split combined lr sr.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\_save vid test.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\_bp.chn","C:\\\\Users\\\\micha\\\\Downloads\\\\Batch_Upscale_Icons.chn","C:\\\\Users\\\\micha\\\\Desktop\\\\chains\\\\crash chain.chn"]',
    'use-system-python': 'false',
    'viewport-export-padding': '20',
};

test(`Migrate settings`, () => {
    const unusedKeys = new Set(Object.keys(oldSettingData));
    const settings = migrateOldStorageSettings({
        keys: Object.keys(oldSettingData),
        getItem: (key: string) => {
            unusedKeys.delete(key);
            return oldSettingData[key] ?? null;
        },
    });

    expect(settings).toMatchSnapshot();
    expect(unusedKeys).toMatchSnapshot();
});
