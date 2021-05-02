import * as THREE from 'three';
import {
    PLYLoader
} from 'three/examples/jsm/loaders/PLYLoader';

let elmTreeXR = {};

const startARbutton = document.querySelector('.js-start-webxr');

navigator.xr.isSessionSupported( 'immersive-ar' ).then( supported => {
    supported ? showStartAR() : showARNotSupported();
} ).catch( showARNotSupported );

function showStartAR() {
    startARbutton.addEventListener('click', e => {
        activateXR();
    });
}

function showARNotSupported() {
    startARbutton.setAttribute('disabled', 'disabled');
    startARbutton.classList.add('is-disabled');
    startARbutton.textContent = "Mixed reality not supported";
}

function init() {
    
    window.addEventListener( 'resize', onWindowResize, false );
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function initThreeJS() {

    elmTreeXR.canvas = document.querySelector('.canvas');
    elmTreeXR.scene = new THREE.Scene();

    elmTreeXR.gl = elmTreeXR.canvas.getContext("webgl", {
        xrCompatible: true
    });
    elmTreeXR.gl.enable(elmTreeXR.gl.DEPTH_TEST);           // Enable depth testing
    elmTreeXR.gl.depthFunc(elmTreeXR.gl.LEQUAL);            // Near things obscure far things
    
    // Set up the WebGLRenderer, which handles rendering to the session's base layer.
    elmTreeXR.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        canvas:  elmTreeXR.canvas,
        context: elmTreeXR.gl
    });


    // Camera
    const width = 10;
    const height = width * (window.innerHeight / window.innerWidth);
    elmTreeXR.camera = new THREE.OrthographicCamera(
        width / -2, // left
        width / 2, // right
        height / 2, // top
        height / -2, // bottom
        1, // near
        100 // far
    );

    elmTreeXR.camera.position.set(4, 1, 4);
    elmTreeXR.camera.lookAt(0, 0, 0);

    elmTreeXR.renderer.setSize(window.innerWidth, window.innerHeight);
    elmTreeXR.renderer.render(elmTreeXR.scene, elmTreeXR.camera);

    // Add it to HTML
    document.body.appendChild(elmTreeXR.renderer.domElement);
}

initThreeJS();

const plyLoader = new PLYLoader();

plyLoader.load('dist/models/home-elm.ply', function (obj) {
    obj.center();
    obj.rotateX(THREE.Math.degToRad(-90));
    obj.translate(-1, obj.boundingBox.max.y, 0);

    const mainElmPointCloud = new THREE.Points(obj, new THREE.PointsMaterial({
        vertexColors: THREE.VertexColors,
        size: 2.4
    }));

    mainElmPointCloud.position.set(0, -3, 0);

    const elmTree = mainElmPointCloud;
    elmTreeXR.scene.add(elmTree);
    elmTreeXR.renderer.render(elmTreeXR.scene, elmTreeXR.camera);
    console.log('Home model loaded');
});

async function activateXR() {

    while(elmTreeXR.scene.children.length > 0){ 
        elmTreeXR.scene.remove(elmTreeXR.scene.children[0]); 
    }

    elmTreeXR.renderer.setClearColor( 0xffffff, 0);
    elmTreeXR.renderer.autoClear = false;

    // The API directly updates the camera matrices.
    // Disable matrix auto updates so three.js doesn't attempt
    // to handle the matrices independently.
    const camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = false;

    // Initialize a WebXR session using "immersive-ar".
    const session = await navigator.xr.requestSession("immersive-ar", { requiredFeatures: ['hit-test'] });
    session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, elmTreeXR.gl)
    });

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    const referenceSpace = await session.requestReferenceSpace("local");

    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await session.requestReferenceSpace('viewer');
    // Perform hit testing using the viewer as origin.
    const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    let reticle;
    let elmTree;   

    plyLoader.load('dist/models/recticle.ply', function (obj) {
        obj.center();
        obj.rotateX(THREE.Math.degToRad(-90));

        const elmTreePointCloud = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 0.002,
            opacity: 0.65
        }));

        reticle = elmTreePointCloud;
        reticle.visible = false;
        elmTreeXR.scene.add(reticle);
        console.log('Reticle model loaded');
    });

    plyLoader.load('dist/models/elm.ply', function (obj) {
        obj.center();
        obj.rotateX(THREE.Math.degToRad(-90));
        obj.translate(0, obj.boundingBox.max.y, 1);

        const pointCloud = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 0.025
        }));

        // pointCloud.scale.set(0.1,0.1,0.1);

        elmTree = pointCloud;
        elmTree.position.copy(reticle.position);
        elmTree.visible = false;
        elmTreeXR.scene.add(elmTree);
        console.log('Main model loaded');
    });

    session.addEventListener("select", (event) => {
        console.log(event, event.inputSource); 
        if (elmTree) {
            elmTree.visible = true;
            elmTree.position.copy(reticle.position);
        }
    });

    // Create a render loop that allows us to draw on the AR view.
    const onXRFrame = (time, frame) => {
        // Queue up the next draw request.
        session.requestAnimationFrame(onXRFrame);

        // Bind the graphics framebuffer to the baseLayer's framebuffer
        elmTreeXR.gl.bindFramebuffer(
            elmTreeXR.gl.FRAMEBUFFER,
            session.renderState.baseLayer.framebuffer
        );

        // Retrieve the pose of the device.
        // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
        const pose = frame.getViewerPose(referenceSpace);
        if (pose) {
            // In mobile AR, we only have one view.
            const view = pose.views[0];

            const viewport = session.renderState.baseLayer.getViewport(view);
            elmTreeXR.renderer.setSize(viewport.width, viewport.height);

            // Use the view's transform matrix and projection matrix to configure the THREE.camera.
            camera.matrix.fromArray(view.transform.matrix);
            camera.projectionMatrix.fromArray(view.projectionMatrix);
            camera.updateMatrixWorld(true);

            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0 && reticle) {
                const hitPose = hitTestResults[0].getPose(referenceSpace);
                reticle.visible = true;
                reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
                reticle.updateMatrixWorld(true);
            }

            // Render the scene with THREE.WebGLRenderer.
            elmTreeXR.renderer.render(elmTreeXR.scene, camera);
        }
    };
    session.requestAnimationFrame(onXRFrame);
}

//

function animate() {

    renderer.setAnimationLoop( render );

}

function render() {

    elmTreeXR.renderer.render( scene, camera );

}