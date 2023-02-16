export interface Integration {
    name: string;
    url: string;
    port: number;
}

export const externalIntegrations: Integration[] = [
    {
        name: 'AUTOMATIC1111/stable-diffusion-webui',
        url: process.env.STABLE_DIFFUSION_HOST ?? '127.0.0.1',
        port: Number(process.env.STABLE_DIFFUSION_PORT ?? 7860),
    },
];
