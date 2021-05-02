import * as THREE from 'three';
import {
    PLYLoader
} from 'three/examples/jsm/loaders/PLYLoader';

let elmXR = {};

function init() {
    initStartButton();

    elmXR.canvas = document.querySelector('.canvas');
    elmXR.scene = new THREE.Scene();
    elmXR.plyLoader = new PLYLoader();

    elmXR.gl = elmXR.canvas.getContext("webgl", {
        xrCompatible: true
    });
    elmXR.gl.enable(elmXR.gl.DEPTH_TEST); // Enable depth testing
    elmXR.gl.depthFunc(elmXR.gl.LEQUAL); // Near things obscure far things

    // Set up the WebGLRenderer, which handles rendering to the session's base layer.
    elmXR.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        canvas: elmXR.canvas,
        context: elmXR.gl
    });

    // Camera
    const width = 10;
    const height = width * (window.innerHeight / window.innerWidth);
    elmXR.camera = new THREE.OrthographicCamera(
        width / -2, // left
        width / 2, // right
        height / 2, // top
        height / -2, // bottom
        1, // near
        100 // far
    );

    setInitialCameraPosition();

    loadInitialModel();
    loadReticleModel();

    animation();

    window.addEventListener('resize', onWindowResize, false);
}

function initStartButton() {
    elmXR.startARbutton = document.querySelector('.js-start-webxr');

    navigator.xr.isSessionSupported('immersive-ar').then(supported => {
        supported ? showStartAR() : showARNotSupported();
    }).catch(showARNotSupported);
}

function showStartAR() {
    elmXR.startARbutton.addEventListener('click', e => {
        activateXR();
    });
}

function showARNotSupported() {
    startARbutton.setAttribute('disabled', 'disabled');
    startARbutton.classList.add('is-disabled');
    startARbutton.textContent = "Mixed reality not supported";
}

function setInitialCameraPosition() {
    elmXR.camera.position.set(4, 1, 4);
    elmXR.camera.lookAt(0, 0, 0);
}

function loadInitialModel() {
    elmXR.plyLoader.load('dist/models/home-elm.ply', obj => {
        obj.center();
        obj.rotateX(THREE.Math.degToRad(-90));
        obj.translate(-1, obj.boundingBox.max.y, 0);

        elmXR.initialModel = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 2.4
        }));

        elmXR.initialModel.position.set(0, -3, 0);

        let elmTree = elmXR.initialModel;
        elmXR.scene.add(elmTree);
        // elmXR.renderer.render(elmXR.scene, elmXR.camera);
        console.log('Home model loaded');
    });
}

function loadReticleModel() {
    elmXR.plyLoader.load('dist/models/home-elm.ply', obj => {
        obj.center();
        obj.rotateX(THREE.Math.degToRad(-90));
        obj.translate(-1, obj.boundingBox.max.y, 0);

        elmXR.reticleModel = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 2.4
        }));

        elmXR.reticleModel.position.set(0, -3, 0);

        let elmTree = elmXR.reticleModel;
        elmXR.scene.add(elmTree);
        // elmXR.renderer.render(elmXR.scene, elmXR.camera);
        console.log('Reticle model loaded');
    });
}

function loadMainModel() {
    elmXR.plyLoader.load('dist/models/elm.ply', obj => {
        obj.center();
        obj.rotateX(THREE.Math.degToRad(-90));
        obj.translate(0, obj.boundingBox.max.y, 1);

        elmXR.mainModel = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 0.025
        }));

        let elmTree = elmXR.mainModel;
        elmTree.position.copy(elmXR.reticleModel.position);
        elmTree.visible = false;
        elmXR.scene.add(elmTree);
        console.log('Main model loaded');
    });
}

async function activateXR() {

    while (elmXR.scene.children.length > 0) {
        elmXR.scene.remove(elmXR.scene.children[0]);
    }

    loadMainModel();

    elmXR.renderer.setClearColor(0xffffff, 0);
    elmXR.renderer.autoClear = false;

    // The API directly updates the camera matrices.
    // Disable matrix auto updates so three.js doesn't attempt
    // to handle the matrices independently.
    elmXR.XRcamera = new THREE.PerspectiveCamera();
    elmXR.XRcamera.matrixAutoUpdate = false;

    // Initialize a WebXR session using "immersive-ar".
    elmXR.session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ['hit-test']
    }).catch(e => { console.log(e) });
    elmXR.session.updateRenderState({
        baseLayer: new XRWebGLLayer(elmXR.session, elmXR.gl)
    });
    elmXR.session.addEventListener("end", () => {
        console.log('On session end!')
    });

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    elmXR.referenceSpace = await elmXR.session.requestReferenceSpace("local").catch(e => { console.log(e) });

    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await elmXR.session.requestReferenceSpace('viewer').catch(e => { console.log(e) });
    // Perform hit testing using the viewer as origin.
    elmXR.hitTestSource = await elmXR.session.requestHitTestSource({
        space: viewerSpace
    }).catch(e => { console.log(e) });

    elmXR.session.addEventListener("select", (event) => {
        console.log(event, event.inputSource);
        if (elmXR.mainModel) {
            elmXR.mainModel.visible = true;
            elmXR.mainModel.position.copy(elmXR.reticleModel.position);
        }
    });

    // elmXR.session.requestAnimationFrame(onXRFrame);
    
}

function onXRFrame(time, frame) {
    // Queue up the next draw request.
    // elmXR.session.requestAnimationFrame(onXRFrame);

    // Bind the graphics framebuffer to the baseLayer's framebuffer

    console.log(elmXR.session);

    elmXR.gl.bindFramebuffer(
        elmXR.gl.FRAMEBUFFER,
        elmXR.session.renderState.baseLayer.framebuffer
    );

    // Retrieve the pose of the device.
    // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
    const pose = frame.getViewerPose(elmXR.referenceSpace);
    if (pose) {
        // In mobile AR, we only have one view.
        const view = pose.views[0];

        const viewport = elmXR.session.renderState.baseLayer.getViewport(view);
        elmXR.renderer.setSize(viewport.width, viewport.height);

        // Use the view's transform matrix and projection matrix to configure the THREE.camera.
        elmXR.XRcamera.matrix.fromArray(view.transform.matrix);
        elmXR.XRcamera.projectionMatrix.fromArray(view.projectionMatrix);
        elmXR.XRcamera.updateMatrixWorld(true);

        const hitTestResults = frame.getHitTestResults(elmXR.hitTestSource);
        if (hitTestResults.length > 0 && elmXR.reticle) {
            const hitPose = hitTestResults[0].getPose(elmXR.referenceSpace);
            elmXR.reticle.visible = true;
            elmXR.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
            elmXR.reticle.updateMatrixWorld(true);
        }

        // Render the scene with THREE.WebGLRenderer.
        elmXR.renderer.render(elmXR.scene, elmXR.XRcamera);
    }
};

function onWindowResize() {
    elmXR.camera.aspect = window.innerWidth / window.innerHeight;
    elmXR.camera.updateProjectionMatrix();

    elmXR.renderer.setSize(window.innerWidth, window.innerHeight);
}

function animation() {
    // elmXR.renderer.render(elmXR.scene, elmXR.camera);
    elmXR.renderer.setAnimationLoop(onXRFrame);
}

init();