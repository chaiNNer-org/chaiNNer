/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Box, Center, Image,
} from '@chakra-ui/react';
import React, { memo } from 'react';
import bg from '../public/splash_imgs/background.png';
import front from '../public/splash_imgs/front.png';

const chaiNNerLogo = ({ size = 1024, percent = 1 }) => (
  <Box display="block" boxSize={size} draggable={false}>
    <Image src={bg} alt="bg" position="relative" top={0} draggable={false} boxSize={size} />
    <Center
      w={size}
      h={size}
      style={{
        position: 'relative',
        top: -size,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 780.92 352.18"
        height={0.35 * size}
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
              animation: '_dashdraw 0.5s linear infinite',
            }}
          />
        </g>
      </svg>
    </Center>
    <Center
      w={size}
      h={size}
      style={{
        position: 'relative',
        top: -size * 2,
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 780.92 352.18"
        height={0.35 * size}
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
              strokeDashoffset: 100 * (1 - percent),
              transition: 'stroke-dashoffset ease-in-out 0.25s',
            }}
          />
        </g>
      </svg>
    </Center>
    <Image src={front} alt="front" position="relative" top={-size * 3} draggable={false} boxSize={size} />
  </Box>
);

export default memo(chaiNNerLogo);
