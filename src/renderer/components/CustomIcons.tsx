import { createIcon } from '@chakra-ui/icons';
import { Icon } from '@chakra-ui/react';
import { memo } from 'react';
import { IconType } from 'react-icons';
import * as bs from 'react-icons/bs';
import * as cg from 'react-icons/cg';
import {
    FaAlignCenter,
    FaAlignLeft,
    FaAlignRight,
    FaBold,
    FaItalic,
    FaPaintBrush,
} from 'react-icons/fa';
import { GiRolledCloth } from 'react-icons/gi';
import * as im from 'react-icons/im';
import * as md from 'react-icons/md';
import { TbChartArrows } from 'react-icons/tb';

const fa = { FaPaintBrush, FaAlignCenter, FaAlignLeft, FaAlignRight, FaBold, FaItalic };
const gi = { GiRolledCloth };
const tb = { TbChartArrows };

const libraries: Partial<Record<string, Partial<Record<string, IconType>>>> = {
    bs,
    cg,
    md,
    im,
    fa,
    gi,
    tb,
};

export const PyTorchIcon = createIcon({
    displayName: 'PyTorchIcon',
    viewBox: '0 0 20.97 24.99',
    // path can also be an array of elements, if you have multiple paths, lines, shapes, etc.
    path: (
        <>
            <path
                d="M17.88 7.31 16 9.17a7.61 7.61 0 0 1 0 11 7.89 7.89 0 0 1-11.11 0 7.61 7.61 0 0 1 0-11l4.9-4.84.7-.69V0l-7.4 7.29a10.24 10.24 0 0 0 0 14.71 10.53 10.53 0 0 0 14.81 0 10.25 10.25 0 0 0-.02-14.69Z"
                fill="currentColor"
            />
            <path
                d="M14.18 6.87a1.35 1.35 0 1 0-1.37-1.35 1.36 1.36 0 0 0 1.37 1.35Z"
                fill="currentColor"
            />
        </>
    ),
});

export const OnnxIcon = createIcon({
    displayName: 'OnnxIcon',
    viewBox: '-1.89 2.11 64 64',
    path: (
        <path
            d="M59.48 32.229c-.278.02-.504-.141-.63-.393L48.58 12.842a.804.804 0 0 1-.065-.71 2.592 2.592 0 0 0-3.969-2.95 1.057 1.057 0 0 1-.939.192l-20.194-4.05a.701.701 0 0 1-.637-.553c-.989-3.358-6.028-1.797-4.945 1.535a.876.876 0 0 1-.136.866L1.67 30.16c-.216.312-.427.445-.747.327a2.586 2.586 0 0 0-2.784 2.225 2.542 2.542 0 0 0 2.21 2.922c.315.01.584.232.655.541l8.624 21.242c.101.226.121.488.05.755-.742 2.428 2.09 4.366 4.083 2.793a.906.906 0 0 1 .697-.204l25.986 2.537a.68.68 0 0 1 .66.453c1.479 3.383 6.505.78 4.592-2.383a.643.643 0 0 1-.007-.745l13.112-22.764a.705.705 0 0 1 .687-.426c3.504.04 3.524-5.234-.007-5.184zm-40.126-20.52.735-3.17c.06-.267.144-.428.488-.449a2.235 2.235 0 0 0 1.654-.863c.161-.251.458-.317.717-.216l20.298 4.052c.055.01.108.038.315.116l-6.388 2.768-19.26 8.388a13.263 13.263 0 0 1-.295.124c-.207.083-.403.277-.64.075-.221-.189-.057-.395-.012-.589l2.39-10.263zm-1.46-1.776.106.07-2.73 11.688a.67.67 0 0 1-.504.559 2.441 2.441 0 0 0-1.784 2.19.723.723 0 0 1-.353.629L3.977 30.16a1.08 1.08 0 0 1-.217.05zm-6.832 45.604a7.344 7.344 0 0 1-.126.503L2.648 35.66a.88.88 0 0 1 .136-1.078 1.938 1.938 0 0 0 .48-1.485.742.742 0 0 1 .461-.795l9.476-5.587c.176-.106.352-.348.614-.101.234.221.554.327.496.79l-.851 7.306-2.401 20.844zm2.962 1.61a1.963 1.963 0 0 0-1-.662c-.233-.075-.392-.168-.314-.39l.742-6.478 1.485-12.9 1.027-9.026c.063-.596.504-.579.856-.798s.468.108.63.252l21.497 18.674a1.002 1.002 0 0 1-.264 1.586l-23.96 9.886c-.284.118-.478.15-.704-.141zm28.05 3.398a1.103 1.103 0 0 0-.48.413c-.331.697-.905.611-1.51.553L15.21 59.058l-.04-.116 3.86-1.606 20.185-8.33c.378-.159.614-.02.967.1 1.006.353 1.026 1.133 1.117 1.956l1.012 8.892c.03.251.025.445-.24.583zm-.857-16.374c-.04.317-.188.408-.44.523s-.559.058-.735-.16l-5.164-4.493-16.37-14.23a1.787 1.787 0 0 1-.437-1.573c.11-.226.385-.252.594-.342l24.833-10.82c.362-.163.644-.251.923.136a1.208 1.208 0 0 0 .521.36c.244.1.345.232.29.395l-.72 5.487-3.267 24.722zm2.824 15.818-.402-3.282-.725-6.292c-.07-.579-.119-1.057.493-1.51a2.215 2.215 0 0 0 .826-2.172c-.026-.24-.02-.39.193-.536l12.159-8.28c.063-.02.126-.036.189-.046zM57.25 33.588a1.888 1.888 0 0 0-.307 1.465.68.68 0 0 1-.355.78L43.556 44.76c-.144.1-.262.282-.504.146-.264-.151-.168-.368-.143-.561l3.956-29.92c.03-.221.08-.438.151-.805l2.353 4.321 7.87 14.555c.26.314.267.77.015 1.092z"
            fill="currentColor"
        />
    ),
});

export const NcnnIcon = createIcon({
    displayName: 'NcnnIcon',
    viewBox: '0 0 14 14',
    path: (
        <path
            d="M3 6.5h1m6 0h1m-8 1h1m6 0h1M1 .5h2m8 0h2m-12 1h1m1 0h1m6 0h1m1 0h1m-13 9h2m9 0h2m-13 1h2m9 0h2m-11 1h1m10 0h1m-14 1h1m1 0h1m8 0h1m1 0h1M0 1.5h1m12 0h1m-14 1h1m12 0h1M2 1.5h1m8 0h1m-11 1h3m6 0h3m-12 1h12m-13 1h14m-14 1h2m4 0h2m4 0h2m-14 1h2m4 0h2m4 0h2m-14 1h2m4 0h2m4 0h2m-14 1h2m4 0h2m4 0h2m-11 1h8m-7 1h6m-8 1h1m1 0h6m3 0h1m-14 1h2m2 0h6m1 0h2m-12 1h1m10 0h1M4 2.5h1m4 0h1M0 3.5h1m12 0h1m-9 3h1m-1 1h1m3 1h2M4 6.5h1m4 0h1m-6 1h1m4 0h1"
            stroke="currentColor"
        />
    ),
});

interface IconFactoryProps {
    icon?: string | null;
    accentColor?: string;
    boxSize?: number;
}
export const IconFactory = memo(({ icon, accentColor, boxSize = 4 }: IconFactoryProps) => {
    const unknownIcon = (
        <Icon
            alignContent="center"
            alignItems="center"
            as={bs.BsQuestionDiamond}
            boxSize={boxSize}
            color="gray.500"
            transition="0.15s ease-in-out"
        />
    );
    if (!icon) {
        return unknownIcon;
    }
    switch (icon) {
        // TODO: Get rid of these hardcoded icons
        case 'PyTorch':
            return (
                <PyTorchIcon
                    color={accentColor}
                    transition="0.15s ease-in-out"
                />
            );
        case 'ONNX':
            return (
                <OnnxIcon
                    color={accentColor}
                    transition="0.15s ease-in-out"
                />
            );
        case 'NCNN':
            return (
                <NcnnIcon
                    color={accentColor}
                    transition="0.15s ease-in-out"
                />
            );
        default:
            break;
    }

    // using segmenter to account for non-latin and emoji characters
    const isSingleCharacter = [...new Intl.Segmenter().segment(icon)].length === 1;
    if (isSingleCharacter) {
        return (
            <h5
                aria-hidden="true"
                className="chakra-heading"
                role="presentation"
                style={{
                    color: accentColor,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    textRendering: 'geometricPrecision',
                    fontFamily: 'Noto Emoji, Open Sans, sans-serif',
                    cursor: 'inherit',
                }}
            >
                {icon}
            </h5>
        );
    }

    const prefix = icon.slice(0, 2).toLowerCase();
    const library = libraries[prefix];
    if (!library) {
        return unknownIcon;
    }
    const libraryIcon = library[icon];
    return (
        <Icon
            alignContent="center"
            alignItems="center"
            as={libraryIcon}
            boxSize={boxSize}
            color={accentColor}
            transition="0.15s ease-in-out"
        />
    );
});

export const DragHandleSVG = createIcon({
    displayName: 'DragHandle',
    viewBox: '0 0 30 30',
    path: (
        <svg fill="currentColor">
            <circle
                cx="1.5"
                cy="13.5"
                fill="currentColor"
                r="1.5"
            />
            <circle
                cx="7.5"
                cy="13.5"
                fill="currentColor"
                r="1.5"
            />
            <circle
                cx="7.5"
                cy="7.5"
                fill="currentColor"
                r="1.5"
            />
            <circle
                cx="13.5"
                cy="1.5"
                fill="currentColor"
                r="1.5"
            />
            <circle
                cx="13.5"
                cy="13.5"
                fill="currentColor"
                r="1.5"
            />
            <circle
                cx="13.5"
                cy="7.5"
                fill="currentColor"
                r="1.5"
            />
        </svg>
    ),
});
