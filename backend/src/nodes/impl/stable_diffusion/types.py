from nodes.impl.stable_diffusion.stable_diffusion import StableDiffusion


class SDKitModel:
    def __init__(self, sd):
        self.sd: StableDiffusion = sd

        self.cache_hash: bytes = sd.cache_hash