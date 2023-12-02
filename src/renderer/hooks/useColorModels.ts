import { useCallback, useEffect, useRef, useState } from 'react';
import { HsvColor, RgbColor } from 'react-colorful';
import { hsvEqual, hsvToRgb, rgbEqual, rgbToHsv } from '../helpers/colorUtil';

const updateRgbX = (o: RgbColor, n: RgbColor): RgbColor => {
    return rgbEqual(o, n) ? o : n;
};
const updateHsvX = (o: HsvColor, n: HsvColor): HsvColor => {
    return hsvEqual(o, n) ? o : n;
};
const updateHsvFromRgbX = (oldHsv: HsvColor, newRgb: RgbColor): HsvColor => {
    const oldRgb = hsvToRgb(oldHsv);
    if (!rgbEqual(newRgb, oldRgb)) {
        const newHsv = rgbToHsv(newRgb);

        // check to see whether we actually need to change H and S
        if (rgbEqual(newRgb, hsvToRgb({ ...newHsv, h: oldHsv.h }))) {
            newHsv.h = oldHsv.h;
        }
        if (rgbEqual(newRgb, hsvToRgb({ ...newHsv, s: oldHsv.s }))) {
            newHsv.s = oldHsv.s;
        }

        if (!hsvEqual(newHsv, oldHsv)) {
            return newHsv;
        }
    }
    return oldHsv;
};

interface UseColorMode {
    rgb: RgbColor;
    hsv: HsvColor;
    changeRgb: (value: RgbColor) => void;
    changeHsv: (value: HsvColor) => void;
}
export const useColorModels = <T>(
    color: T,
    toRgbColor: (color: T) => RgbColor,
    onChange: (value: RgbColor) => void,
): UseColorMode => {
    const [state, setState] = useState<readonly [RgbColor, HsvColor]>(() => {
        const rgb = toRgbColor(color);
        return [rgb, rgbToHsv(rgb)];
    });
    const lastChangeRef = useRef(0);

    const updateFromRgb = useCallback((newRgb: RgbColor): void => {
        setState((old) => {
            const [oldRgb, oldHsv] = old;

            if (!rgbEqual(oldRgb, newRgb)) {
                return [newRgb, updateHsvFromRgbX(oldHsv, newRgb)];
            }
            return old;
        });
    }, []);
    const updateFromHsv = useCallback((newHsv: HsvColor, newRgb: RgbColor): void => {
        setState((old) => {
            const [oldRgb, oldHsv] = old;

            // eslint-disable-next-line no-param-reassign
            newRgb = updateRgbX(oldRgb, newRgb);
            // eslint-disable-next-line no-param-reassign
            newHsv = updateHsvX(oldHsv, newHsv);

            if (newHsv !== oldHsv || newRgb !== oldRgb) {
                return [newRgb, newHsv];
            }
            return old;
        });
    }, []);

    useEffect(() => {
        const sinceLastChange = Date.now() - lastChangeRef.current;
        if (sinceLastChange > 200) {
            updateFromRgb(toRgbColor(color));
        }
    }, [color, updateFromRgb, toRgbColor]);

    const changeRgb = useCallback(
        (newRgb: RgbColor): void => {
            lastChangeRef.current = Date.now();
            updateFromRgb(newRgb);
            onChange(newRgb);
        },
        [onChange, updateFromRgb],
    );
    const changeHsv = useCallback(
        (newHsv: HsvColor): void => {
            lastChangeRef.current = Date.now();
            const newRgb = hsvToRgb(newHsv);
            updateFromHsv(newHsv, newRgb);
            onChange(newRgb);
        },
        [onChange, updateFromHsv],
    );

    const [rgb, hsv] = state;
    return { rgb, hsv, changeRgb, changeHsv };
};
