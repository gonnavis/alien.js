import { NoBlending, RawShaderMaterial, Uniform } from 'three';

import vertexShader from '../shaders/VideoGlitchPass.vert.js';
import fragmentShader from '../shaders/VideoGlitchPass.frag.js';

export class VideoGlitchMaterial extends RawShaderMaterial {
    constructor() {
        super({
            uniforms: {
                tMap: new Uniform(null),
                uTime: new Uniform(0)
            },
            vertexShader,
            fragmentShader,
            blending: NoBlending,
            depthWrite: false,
            depthTest: false
        });
    }
}
