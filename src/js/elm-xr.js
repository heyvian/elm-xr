import * as THREE from 'three';
import {
    PLYLoader
} from 'three/examples/jsm/loaders/PLYLoader';
import {
    OrbitControls
} from "three/examples/jsm/controls/OrbitControls.js";



import {
    ARButton
} from './ARButton';

var container;
var camera, XRcamera, gl, scene, controls, renderer, session, referenceSpace, hitTestSource;
var controller;
var plyLoader = new PLYLoader();
var initialModel, reticleModel, mainModel, baseModel;

init();
animate();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerHeight / window.innerWidth, 1, 200);

    setInitialCameraPosition();

    var light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(document.body.clientWidth, document.body.clientHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);
    // gl = renderer.domElement.getContext("webgl", {
    //     xrCompatible: true
    // });
    // gl.enable(gl.DEPTH_TEST); // Enable depth testing
    // gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.25;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target = new THREE.Vector3(0, 3, 0);

    //
    var arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['local-floor', 'hit-test']
    });

    function onSelect(e) {
        console.log('onSelect()');
        if (renderer.xr.isPresenting) {
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.copy(reticleModel.position);
            }
        }

    }

    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // loadInitialModel();
    // loadReticleModel();
    loadBaseModel();

    renderer.xr.addEventListener('sessionstart', onSessionStarted);
    renderer.xr.addEventListener('sessionend', onSessionEnded);

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();
}

async function onSessionStarted(e) {
    const thisXR = e.target;
    XRcamera = new THREE.PerspectiveCamera();
    XRcamera.matrixAutoUpdate = false;

    // loadMainModel();
    if(!mainModel) {
        setMainModel();
    }

    if (initialModel) {
        initialModel.visible = false;
    }
    if (reticleModel) {
        scene.add(reticleModel);
        reticleModel.visible = true;
    }

    session = thisXR.getSession();

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    referenceSpace = await session.requestReferenceSpace("local-floor").catch(e => {
        console.log(e)
    });

    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await session.requestReferenceSpace('viewer').catch(e => {
        console.log(e)
    });
    // Perform hit testing using the viewer as origin.
    hitTestSource = await session.requestHitTestSource({
        space: viewerSpace
    }).catch(e => {
        console.log(e)
    });
}

async function onSessionEnded(e) {
    if (initialModel) {
        initialModel.visible = true;
    }
    if (reticleModel) {
        scene.add(reticleModel);
        reticleModel.visible = false;
    }
    if (mainModel) {
        mainModel.visible = false;
    }
}

function onWindowResize() {

    if (!renderer.xr.isPresenting) {
        camera.aspect = document.body.clientWidth / document.body.clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(document.body.clientWidth, document.body.clientHeight);
    }

}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(time, frame) {
    // console.log(renderer);
    if (renderer.xr.isPresenting) {
        const pose = frame.getViewerPose(referenceSpace);
        if (pose) {
            // In mobile AR, we only have one view.
            const view = pose.views[0];

            // Use the view's transform matrix and projection matrix to configure the THREE.camera.
            XRcamera.matrix.fromArray(view.transform.matrix);
            XRcamera.projectionMatrix.fromArray(view.projectionMatrix);
            XRcamera.updateMatrixWorld(true);

            const hitTestResults = frame.getHitTestResults(hitTestSource);

            reticleModel.visible = false;

            if (hitTestResults.length > 0 && reticleModel) {
                const hitPose = hitTestResults[0].getPose(referenceSpace);
                reticleModel.visible = true;
                reticleModel.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
                // For wall detection to change angle
                // reticleModel.rotation.set(hitPose.transform.orientation.x, hitPose.transform.orientation.y, hitPose.transform.orientation.z);
                reticleModel.updateMatrixWorld(true);
            }

            // Render the scene with THREE.WebGLRenderer.
            renderer.render(scene, XRcamera);
        }
    } else {
        controls.update();
        renderer.render(scene, camera);
    }

}

function loadBaseModel() {
    plyLoader.load('dist/models/base.ply', obj => {
        baseModel = obj.clone();
        baseModel.center();
        baseModel.rotateX(THREE.Math.degToRad(-90));
        console.log('Base model loaded');
        setHomeModel();
        setReticleModel();
    });
}

function setHomeModel() {
    var homeObj = baseModel.clone();
    // homeObj.rotateX(THREE.Math.degToRad(-90));
    homeObj.translate(0, homeObj.boundingBox.max.y, 1.25);

    initialModel = new THREE.Points(homeObj, new THREE.PointsMaterial({
        vertexColors: THREE.VertexColors,
        size: 0.12
    }));

    scene.add(initialModel);
    console.log('Home model set');
}

function setReticleModel() {
    var reticleObj = baseModel.clone();
    // reticleObj.center();
    // reticleObj.rotateX(THREE.Math.degToRad(-90));
    const scale = 0.035;
    reticleObj.scale(scale, scale, scale);
    // obj.translate(0,1, -1);

    reticleModel = new THREE.Points(reticleObj, new THREE.PointsMaterial({
        vertexColors: THREE.VertexColors,
        size: 0.011,
        opacity: 0.5
    }));

    // scene.add(reticleModel);
    console.log('Reticle model set');
}

function setMainModel() {
    var mainObj = baseModel.clone();
    // mainObj.center();
    // mainObj.rotateX(THREE.Math.degToRad(-90));
    mainObj.translate(0, mainObj.boundingBox.max.y * 0.99, 1);

    mainModel = new THREE.Points(mainObj, new THREE.PointsMaterial({
        vertexColors: THREE.VertexColors,
        size: 0.085
    }));

    mainModel.position.copy(reticleModel.position);
    mainModel.visible = false;

    scene.add(mainModel);
    console.log('Main model set');
}

function loadInitialModel() {
    plyLoader.load('dist/models/home-elm.ply', obj => {
        // obj.center();
        // obj.rotateX(THREE.Math.degToRad(-90));
        obj.translate(0, obj.boundingBox.max.y, 1.25);

        initialModel = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 0.12
        }));

        initialModel.position.set(0, 0, 0);

        scene.add(initialModel);
        console.log('Home model loaded');
    });
}

function loadReticleModel() {
    plyLoader.load('dist/models/reticle.ply', obj => {
        obj.center();
        obj.rotateX(THREE.Math.degToRad(-90));
        // obj.translate(0,1, -1);

        reticleModel = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 0.02,
            opacity: 0.65
        }));

        // scene.add(reticleModel);
        console.log('Reticle model loaded');
    });
}

function loadMainModel() {
    plyLoader.load('dist/models/home-elm.ply', obj => {
        obj.center();
        obj.rotateX(THREE.Math.degToRad(-90));
        obj.translate(0, obj.boundingBox.max.y - 0.2, 1);

        mainModel = new THREE.Points(obj, new THREE.PointsMaterial({
            vertexColors: THREE.VertexColors,
            size: 0.085
        }));

        mainModel.position.copy(reticleModel.position);
        mainModel.visible = false;
        scene.add(mainModel);
        console.log('Main model loaded');
    });
}

function setInitialCameraPosition() {
    camera.position.set(0, 1.5, -24);
}