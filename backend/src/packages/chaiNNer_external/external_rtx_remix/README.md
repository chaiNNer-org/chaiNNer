# RTX Remix Nodes

This directory contains nodes for interacting with [NVIDIA RTX Remix](https://www.nvidia.com/en-us/geforce/rtx-remix/) via its REST API.

## Overview

RTX Remix is NVIDIA's platform for remastering classic games with modern ray tracing and AI-enhanced graphics. These nodes allow chaiNNer to communicate with a running RTX Remix instance to:

- Query scene information
- List and replace textures
- List and modify materials
- Query lighting information

## Setup

1. Launch RTX Remix with the REST API enabled
2. By default, chaiNNer will attempt to connect to `http://127.0.0.1:8111`
3. Customize the connection using environment variables:
   - `RTX_REMIX_PROTOCOL`: Protocol to use (http or https)
   - `RTX_REMIX_HOST`: Host address (default: 127.0.0.1)
   - `RTX_REMIX_PORT`: Port number (default: 8111)

## Available Nodes

### Get Scene Info
Retrieves information about the current RTX Remix scene.

**Inputs:** None  
**Outputs:** Scene Info (JSON string)

### List Textures
Lists all textures in the current scene.

**Inputs:** None  
**Outputs:** Textures List (JSON string)

### Replace Texture
Replaces a texture in the scene with a new image.

**Inputs:**
- Texture Name (string): Name of the texture to replace
- New Texture Image (image): The new texture to use

**Outputs:** Result (JSON string)

### List Materials
Lists all materials in the current scene.

**Inputs:** None  
**Outputs:** Materials List (JSON string)

### Get Material Properties
Gets the properties of a specific material.

**Inputs:** Material Name (string)  
**Outputs:** Material Properties (JSON string)

### Update Material Property
Updates a property of a material.

**Inputs:**
- Material Name (string)
- Property Name (string): e.g., "roughness", "metallic"
- Property Value (number): Value between 0 and 1

**Outputs:** Result (JSON string)

### List Lights
Lists all lights in the current scene.

**Inputs:** None  
**Outputs:** Lights List (JSON string)

## API Reference

For more information about the RTX Remix REST API, see:
https://docs.omniverse.nvidia.com/kit/docs/rtx_remix/1.2.4/docs/howto/learning-restapi.html

## Notes

- These nodes require an active RTX Remix runtime with REST API support
- The API must be accessible from the machine running chaiNNer
- All responses are returned as JSON strings for maximum flexibility
- Use chaiNNer's text processing nodes to parse and manipulate the JSON responses
