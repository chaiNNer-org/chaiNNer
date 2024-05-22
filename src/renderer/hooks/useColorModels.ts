import { useCallback, useEffect, useRef, useState } from 'react';
import { Color, HsvColor, HsvColorLike, RgbColorLike } from '../helpers/color';

const updateRgbX = (o: Color, n: Color): Color => {
    return o.equals(n) ? o : n;
};
const updateHsvX = (o: HsvColor, n: HsvColor): HsvColor => {
    return o.equals(n) ? o : n;
};
const updateHsvFromRgbX = (oldHsv: HsvColor, newRgb: Color): HsvColor => {
    const oldRgb = oldHsv.rgb();
    if (!newRgb.equals(oldRgb)) {
        const newHsv = newRgb.hsv();

        // check to see whether we actually need to change H and S
        if (newRgb.equals(newHsv.with({ h: oldHsv.h }).rgb())) {
            newHsv.h = oldHsv.h;
        }
        if (newRgb.equals(newHsv.with({ s: oldHsv.s }).rgb())) {
            newHsv.s = oldHsv.s;
        }

        if (!newHsv.equals(oldHsv)) {
            return newHsv;
        }
    }
    return oldHsv;
};

interface UseColorMode {
    rgb: Color;
    hsv: HsvColor;
    changeRgb: (value: RgbColorLike) => void;
    changeHsv: (value: HsvColorLike) => void;
}
export const useColorModels = <T>(
    color: T,
    toRgbColor: (color: T) => Color,
    onChange: (value: Color) => void
): UseColorMode => {
    const [state, setState] = useState<readonly [Color, HsvColor]>(() => {
        const rgb = toRgbColor(color);
        return [rgb, rgb.hsv()];
    });
    const lastChangeRef = useRef(0);

    const updateFromRgb = useCallback((newRgb: Color): void => {
        setState((old) => {
            const [oldRgb, oldHsv] = old;

            if (!oldRgb.equals(newRgb)) {
                return [newRgb, updateHsvFromRgbX(oldHsv, newRgb)];
            }
            return old;
        });
    }, []);
    const updateFromHsv = useCallback((newHsv: HsvColor, newRgb: Color): void => {
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
        (newRgb: RgbColorLike): void => {
            lastChangeRef.current = Date.now();
            const rgb = Color.from(newRgb);
            updateFromRgb(rgb);
            onChange(rgb);
        },
        [onChange, updateFromRgb]
    );
    const changeHsv = useCallback(
        (newHsv: HsvColorLike): void => {
            lastChangeRef.current = Date.now();
            const hsv = HsvColor.from(newHsv);
            const newRgb = hsv.rgb();
            updateFromHsv(hsv, newRgb);
            onChange(newRgb);
        },
        [onChange, updateFromHsv]
    );

    const [rgb, hsv] = state;
    return { rgb, hsv, changeRgb, changeHsv };
};
