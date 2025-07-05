# Serverless Implementation

This directory contains the serverless implementation of the image generation system for the live lecture and exhibition. This is the new system.

It is designed to be used with Modal, a serverless platform that allows us to run GPU instances without worrying about the underlying infrastructure.

Refer to the [README.md](../README.md) for more information on the overall architecture and how to run the system.

## Modes

It has two modes of operation:

- **Pre-randomized**: the generation is done in advance and the images are stored in an object storage. The API serves the images based on the actions defined in the transcript. We should use HTTP for communication instead of WebSocket to avoid the stateful headaches of WebSockets. This uses the [preprocessor](./preprocessor) to generate the images in advance and store them in an object storage like Cloudflare R2.

  - This is the primary mode of operation.

- **Live**: the generation is done live. The API uses WebSocket to communicate with the frontend and generate images in real-time. This is used for the live lecture mostly.

Both modes should import modules from the `common` directory to share the same logic for generating images and handling actions. Examples: pipeline configuration.

## Optimizations

- Do not create multiple diffusion pipelines in the same instances. That uses more memory that needed. Instead, we can turn LORA on and off as needed, and tweak the pipeline configuration to use the correct model.
