import { useEffect, useState } from 'react';

export const useDevicePixelRatio = (): number => {
    const [value, setValue] = useState(window.devicePixelRatio);

    useEffect(() => {
        const update = () => setValue(window.devicePixelRatio);
        const mediaMatcher = window.matchMedia(`screen and (resolution: ${value}dppx)`);
        mediaMatcher.addEventListener('change', update);

        return () => {
            mediaMatcher.removeEventListener('change', update);
        };
    }, [value]);

    return value;
};
