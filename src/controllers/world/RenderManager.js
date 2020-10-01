import { AdditiveBlending, Mesh, NoBlending, OrthographicCamera, Scene, Vector2, WebGLRenderTarget } from 'three';

import { WorldController } from './WorldController.js';
import { FXAAMaterial } from '../../materials/FXAAMaterial.js';
import { LuminosityMaterial } from '../../materials/LuminosityMaterial.js';
import { UnrealBloomBlurMaterial } from '../../materials/UnrealBloomBlurMaterial.js';
import { BloomCompositeMaterial } from '../../materials/BloomCompositeMaterial.js';
import { BlurDirectionX, BlurDirectionY } from '../../materials/BlurMaterial.js';
import { CopyMaterial } from '../../materials/CopyMaterial.js';

import { mix } from '../../utils/Utils.js';

export class RenderManager {
    static init(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.luminosityThreshold = 0.1;
        this.bloomStrength = 0.3;
        this.bloomRadius = 0.75;

        this.initRenderer();
    }

    static initRenderer() {
        const { resolution, screenTriangle } = WorldController;

        this.renderer.autoClear = false;

        // Fullscreen triangle
        this.screenScene = new Scene();
        this.screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.screen = new Mesh(screenTriangle);
        this.screen.frustumCulled = false;
        this.screenScene.add(this.screen);

        // Render targets
        this.renderTargetA = new WebGLRenderTarget(1, 1, {
            anisotropy: 0,
            depthBuffer: false
        });

        this.renderTargetB = this.renderTargetA.clone();

        this.renderTargetsHorizontal = [];
        this.renderTargetsVertical = [];
        this.nMips = 5;

        this.renderTargetBright = this.renderTargetA.clone();

        for (let i = 0, l = this.nMips; i < l; i++) {
            this.renderTargetsHorizontal.push(this.renderTargetA.clone());
            this.renderTargetsVertical.push(this.renderTargetA.clone());
        }

        this.renderTargetA.depthBuffer = true;

        // FXAA material
        this.fxaaMaterial = new FXAAMaterial();
        this.fxaaMaterial.uniforms.uResolution = resolution;

        // Luminosity high pass material
        this.luminosityMaterial = new LuminosityMaterial();
        this.luminosityMaterial.uniforms.uLuminosityThreshold.value = this.luminosityThreshold;

        // Gaussian blur materials
        this.blurMaterials = [];

        const kernelSizeArray = [3, 5, 7, 9, 11];

        for (let i = 0, l = this.nMips; i < l; i++) {
            this.blurMaterials.push(new UnrealBloomBlurMaterial(kernelSizeArray[i]));
            this.blurMaterials[i].uniforms.uResolution.value = new Vector2();
        }

        // Bloom composite material
        const bloomFactors = [1.0, 0.8, 0.6, 0.4, 0.2];

        for (let i = 0, l = this.nMips; i < l; i++) {
            const factor = bloomFactors[i];
            bloomFactors[i] = this.bloomStrength * mix(factor, 1.2 - factor, this.bloomRadius);
        }

        this.bloomCompositeMaterial = new BloomCompositeMaterial(this.nMips);
        this.bloomCompositeMaterial.uniforms.tBlur1.value = this.renderTargetsVertical[0].texture;
        this.bloomCompositeMaterial.uniforms.tBlur2.value = this.renderTargetsVertical[1].texture;
        this.bloomCompositeMaterial.uniforms.tBlur3.value = this.renderTargetsVertical[2].texture;
        this.bloomCompositeMaterial.uniforms.tBlur4.value = this.renderTargetsVertical[3].texture;
        this.bloomCompositeMaterial.uniforms.tBlur5.value = this.renderTargetsVertical[4].texture;
        this.bloomCompositeMaterial.uniforms.uBloomFactors.value = bloomFactors;

        // Copy material
        this.copyMaterial = new CopyMaterial();
    }

    /**
     * Public methods
     */

    static resize = (width, height, dpr) => {
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(width, height);

        width = Math.round(width * dpr);
        height = Math.round(height * dpr);

        this.renderTargetA.setSize(width, height);
        this.renderTargetB.setSize(width, height);

        width = Math.round(width / 2);
        height = Math.round(height / 2);

        this.renderTargetBright.setSize(width, height);

        for (let i = 0, l = this.nMips; i < l; i++) {
            this.renderTargetsHorizontal[i].setSize(width, height);
            this.renderTargetsVertical[i].setSize(width, height);

            this.blurMaterials[i].uniforms.uResolution.value.set(width, height);

            width = Math.round(width / 2);
            height = Math.round(height / 2);
        }
    };

    static update = () => {
        const renderer = this.renderer;
        const scene = this.scene;
        const camera = this.camera;

        const screenScene = this.screenScene;
        const screenCamera = this.screenCamera;

        const renderTargetA = this.renderTargetA;
        const renderTargetB = this.renderTargetB;
        const renderTargetBright = this.renderTargetBright;
        const renderTargetsHorizontal = this.renderTargetsHorizontal;
        const renderTargetsVertical = this.renderTargetsVertical;

        // Scene pass
        renderer.setRenderTarget(renderTargetA);
        renderer.clear();
        renderer.render(scene, camera);

        // FXAA pass
        this.fxaaMaterial.uniforms.tMap.value = renderTargetA.texture;
        this.screen.material = this.fxaaMaterial;
        renderer.setRenderTarget(renderTargetB);
        renderer.clear();
        renderer.render(screenScene, screenCamera);

        // Render to screen
        this.copyMaterial.uniforms.tMap.value = renderTargetB.texture;
        this.copyMaterial.blending = NoBlending;
        this.screen.material = this.copyMaterial;
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(screenScene, screenCamera);

        // Extract bright areas
        this.luminosityMaterial.uniforms.tMap.value = renderTargetB.texture;
        this.screen.material = this.luminosityMaterial;
        renderer.setRenderTarget(renderTargetBright);
        renderer.clear();
        renderer.render(screenScene, screenCamera);

        // Blur all the mips progressively
        let inputRenderTarget = renderTargetBright;

        for (let i = 0, l = this.nMips; i < l; i++) {
            this.screen.material = this.blurMaterials[i];

            this.blurMaterials[i].uniforms.tMap.value = inputRenderTarget.texture;
            this.blurMaterials[i].uniforms.uDirection.value = BlurDirectionX;
            renderer.setRenderTarget(renderTargetsHorizontal[i]);
            renderer.clear();
            renderer.render(screenScene, screenCamera);

            this.blurMaterials[i].uniforms.tMap.value = this.renderTargetsHorizontal[i].texture;
            this.blurMaterials[i].uniforms.uDirection.value = BlurDirectionY;
            renderer.setRenderTarget(renderTargetsVertical[i]);
            renderer.clear();
            renderer.render(screenScene, screenCamera);

            inputRenderTarget = renderTargetsVertical[i];
        }

        // Composite all the mips
        this.screen.material = this.bloomCompositeMaterial;
        renderer.setRenderTarget(renderTargetsHorizontal[0]);
        renderer.clear();
        renderer.render(screenScene, screenCamera);

        // Render to screen (blend it additively)
        this.copyMaterial.uniforms.tMap.value = renderTargetsHorizontal[0].texture;
        this.copyMaterial.blending = AdditiveBlending;
        this.screen.material = this.copyMaterial;
        renderer.setRenderTarget(null);
        renderer.render(screenScene, screenCamera);
    };
}
