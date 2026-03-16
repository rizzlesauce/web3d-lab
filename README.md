# React Three Fiber Demo

Interactive real-time 3D scene built with React Three Fiber and Three.js, demonstrating a modern PBR rendering pipeline with HDR lighting, environment reflections, and mobile-optimized performance.

Live Demo:  
https://ross-web3d-lab.onrender.com

Tip: rotate the scene to see HDR reflections and lighting changes across materials.

## Demo Videos
Desktop (ROG Strix G18 laptop)

https://github.com/user-attachments/assets/e578c89f-118c-4a47-bc4c-0f013443a8ed

Mobile (Google Pixel 7)

https://github.com/user-attachments/assets/ff47deca-a10a-4643-a4d7-ca236c618907

## Features

### Rendering Pipeline
* HDR environment lighting with background and ground projection
* Physically-based rendering (PBR materials)
* Cube camera reflections with PMREM processing
* Custom shaders

### Scene & Interaction
* Animated GLB model
* Floating particle system (dynamically regenerating)
* Orbit controls

### Visual Quality
* Soft shadows
* Screen-space ambient occlusion (N8AO)
* Contact shadows
* Depth of field
* Bloom

### Post-Processing
* ACES filmic tone mapping
* Brightness / contrast adjustments
* Subpixel morphological anti-aliasing (SMAA)

### Performance
* Desktop / mobile support
* GPU tier detection and dynamic performance optimization

## Tech Stack

* React
* Vite
* React Three Fiber
* Three.js
* TypeScript
* WebGL

## Notes

* Tested on desktop Chrome and Google Pixel 7
* Includes device-aware quality/performance adjustments
* Mobile rendering quality is tuned based on device capability
