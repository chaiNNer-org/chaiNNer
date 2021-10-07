/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
import {
  Box, Center, Heading, HStack, Text, useColorModeValue, VStack,
} from '@chakra-ui/react';
import React from 'react';
import { IconFactory } from '../components/CustomIcons.jsx';
import ImageFileInput from '../components/inputs/ImageFileInput.jsx';
import PthFileInput from '../components/inputs/PthFileInput.jsx';
import ImageOutput from '../components/outputs/ImageOutput.jsx';
import getAccentColor from './getNodeAccentColors.js';

export const createNodeTypes = (data) => {
  console.log(data);
  const nodesList = {};
  if (data) {
    data.forEach(({ category, nodes }) => {
      nodes.forEach((node) => {
        const newNode = () => (
          <Center
            bg={useColorModeValue('gray.50', 'gray.700')}
            borderWidth="1px"
            borderRadius="lg"
            py={2}
            boxShadow="lg"
          >
            <VStack>
              <Center
                w="full"
                borderBottomColor={getAccentColor(category)}
                borderBottomWidth="4px"
              >
                <HStack
                  pl={6}
                  pr={6}
                  pb={2}
                >
                  <Center>
                    {IconFactory(category)}
                  </Center>
                  <Center>
                    <Heading as="h5" size="sm" m={0} p={0} fontWeight={700}>
                      {node.name.toUpperCase()}
                    </Heading>
                  </Center>
                </HStack>
              </Center>

              <Text fontSize="xs" p={0} m={0}>
                INPUTS
              </Text>
              {node.inputs.map((input, i) => {
                switch (input.type) {
                  case 'file::image':
                    return (
                      <ImageFileInput key={i} extensions={input.filetypes} />
                    );
                  case 'file::pth':
                    return (
                      <PthFileInput key={i} extensions={input.filetypes} />
                    );
                  default:
                    return (
                      <Box>
                        <Text>
                          {input.label}
                        </Text>
                      </Box>
                    );
                }
              })}

              <Text fontSize="xs" p={0} m={0}>
                OUTPUTS
              </Text>
              {node.outputs.map((input, i) => {
                switch (input.type) {
                  case 'numpy::2d':
                    return (
                      <ImageOutput key={i} path="C:/Users/Joey/Desktop/discord alt REWRITTEN OMG 2.png" />
                    );
                  default:
                    return (
                      <Box>
                        <Text>
                          {input.label}
                        </Text>
                      </Box>
                    );
                }
              })}
            </VStack>
          </Center>
        );
        nodesList[node.name] = newNode;
        console.log('nodes list', nodesList);
      });
    });
  }
  return nodesList;
};
