import { Box, Center, Image } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import bg from '../../public/splash_imgs/background.png';
import front from '../../public/splash_imgs/front.png';

// eslint-disable-next-line @typescript-eslint/naming-convention
interface chaiNNerLogoProps {
    size?: number;
    percent?: number;
}

export const ChaiNNerLogo = memo(({ size = 1024, percent = 100 }: chaiNNerLogoProps) => {
    const { t } = useTranslation();

    return (
    <Box
        boxSize={size}
        display="block"
        draggable={false}
    >
        <Image
            alt={t('logo.background', 'bg')}
            boxSize={size}
            draggable={false}
            loading="eager"
            position="relative"
            src={bg}
            top={0}
        />
        <Center
            h={size}
            style={{
                position: 'relative',
                top: -size,
            }}
            w={size}
        >
            <svg
                height={0.35 * size}
                viewBox="0 0 780.92 352.18"
                xmlns="http://www.w3.org/2000/svg"
            >
                <g data-name="Layer 2">
                    <path
                        d="M98.9 11.9s-327.3 42.2 288.52 159.66 301.07 168.78 301.07 168.78"
                        pathLength="100"
                        style={{
                            fill: 'none',
                            strokeWidth: '20px',
                            stroke: 'var(--chakra-colors-gray-500)',
                            strokeDasharray: 5,
                            animation: 'logo-dashdraw 0.5s linear infinite',
                        }}
                    />
                </g>
            </svg>
        </Center>
        <Center
            h={size}
            style={{
                position: 'relative',
                top: -size * 2,
            }}
            w={size}
        >
            <svg
                height={0.35 * size}
                viewBox="0 0 780.92 352.18"
                xmlns="http://www.w3.org/2000/svg"
            >
                <g data-name="Layer 2">
                    <path
                        d="M98.9 11.9s-327.3 42.2 288.52 159.66 301.07 168.78 301.07 168.78"
                        pathLength="100"
                        style={{
                            fill: 'none',
                            strokeWidth: '24px',
                            stroke: 'var(--chakra-colors-red-600)',
                            strokeDasharray: 100,
                            strokeDashoffset: 100 - percent,
                            transition: 'stroke-dashoffset ease-in-out 0.25s',
                        }}
                    />
                </g>
            </svg>
        </Center>
        <Image
            alt={t('logo.front', 'front')}
            boxSize={size}
            draggable={false}
            loading="eager"
            position="relative"
            src={front}
            top={-size * 3}
        />
    </Box>
    );
});
