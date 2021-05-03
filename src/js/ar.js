import * as THREE from 'three';
import {
    PLYLoader
} from 'three/examples/jsm/loaders/PLYLoader';
import {
    OrbitControls
} from "three/examples/jsm/controls/OrbitControls.js";

var plyLoader = new PLYLoader();
var container;
var camera, XRcamera, gl, scene, controls, renderer, referenceSpace, hitTestSource;
var session;
var currentSession = null;
var controller;
var initialModel, reticleModel, mainModel, baseModel;
var treeScale = 3.5;
var mainModelPointSize = 0.085;
var elmPlaced = false;

var overlay = document.querySelector('.js-ar-overlay');
var startARbtn = document.querySelector('.js-start-webxr');
var closeARbtn = document.querySelector('.js-close-webxr');
var placeElmBtn = document.querySelector('.js-place-elm');
var scaleFactorTest = document.querySelector('.js-scale-factor');
var scaleSliderWrapper = document.querySelector('.js-scale-slider-wrapper');
var scaleSlider = document.querySelector('.js-scale-slider');

init();
animate();

function init() {

    container = document.querySelector('.js-ar-container');

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
    controls.target = new THREE.Vector3(0, 2, 0);

    function onSelect(e) {
        console.log('onSelect()');
    }

    session = {
        requiredFeatures: ['local-floor', 'hit-test']
    };

    if (session.domOverlay === undefined) {

        overlay = document.querySelector('.js-ar-overlay');

        if (session.optionalFeatures === undefined) {

            session.optionalFeatures = [];

        }

        session.optionalFeatures.push('dom-overlay');
        session.domOverlay = {
            root: overlay
        };

    }

    startARbtn.addEventListener('click', e => {
        if (currentSession === null) {
            navigator.xr.requestSession('immersive-ar', session).then(onSessionStarted);
        }
    });

    closeARbtn.addEventListener('click', e => {
        currentSession.end();
    });

    placeElmBtn.addEventListener('click', e => {
        if (renderer.xr.isPresenting) {
            if (mainModel && !elmPlaced) {
                mainModel.visible = true;
                mainModel.position.copy(reticleModel.position);
                elmPlaced = true;
            } else if (mainModel && elmPlaced) {
                mainModel.visible = false;
                elmPlaced = false;
            }
        }
    });

    var ratio = calculateRatio(treeScale, 100);
    scaleFactorTest.textContent = ratio;

    scaleSlider.addEventListener('input', e => {
        treeScale = e.target.value;
        ratio = calculateRatio(e.target.value, 100);

        scaleFactorTest.textContent = ratio;
    })

    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    loadBaseModel();

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();
}

async function onSessionStarted(session) {
    session.addEventListener('end', onSessionEnded);
    console.log('Session started: ', session);

    await renderer.xr.setSession(session);
    currentSession = session;

    XRcamera = new THREE.PerspectiveCamera();
    XRcamera.matrixAutoUpdate = false;

    if (!mainModel) {
        setMainModel();
    }
    if (initialModel) {
        initialModel.visible = false;
    }
    if (reticleModel) {
        scene.add(reticleModel);
        reticleModel.visible = true;
    }

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    referenceSpace = await currentSession.requestReferenceSpace("local-floor").catch(e => {
        console.log(e)
    });

    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await currentSession.requestReferenceSpace('viewer').catch(e => {
        console.log(e)
    });

    // Perform hit testing using the viewer as origin.
    hitTestSource = await currentSession.requestHitTestSource({
        space: viewerSpace
    }).catch(e => {
        console.log(e)
    });

    document.querySelector('body').classList.add('has-ar');
}

async function onSessionEnded() {
    currentSession.removeEventListener('end', onSessionEnded);
    currentSession = null;

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

    document.querySelector('body').classList.remove('has-ar');
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

            var mainModelScale = treeScale / 100;
            var updatedMainModelPointSize = mainModelPointSize * mainModelScale;
            mainModel.material.size = updatedMainModelPointSize;

            mainModel.scale.set(mainModelScale, mainModelScale, mainModelScale);

            var reticleModelScale = treeScale / 100;
            var updatedReticleModelPointSize = mainModelPointSize * reticleModelScale;
            reticleModel.material.size = updatedReticleModelPointSize;

            reticleModel.scale.set(reticleModelScale, reticleModelScale, reticleModelScale);

            if (hitTestResults.length > 0 && reticleModel) {
                const hitPose = hitTestResults[0].getPose(referenceSpace);
                if (!elmPlaced) {
                    reticleModel.visible = true;
                    placeElmBtn.textContent = "Place Elm";
                } else {
                    reticleModel.visible = false;
                    placeElmBtn.textContent = "Remove Elm";
                    placeElmBtn.classList.add('is-remove');
                }
                reticleModel.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
                // For wall detection to change angle
                // reticleModel.rotation.set(hitPose.transform.orientation.x, hitPose.transform.orientation.y, hitPose.transform.orientation.z);
                reticleModel.updateMatrixWorld(true);

                scaleSliderWrapper.classList.add('has-hitpose');
                placeElmBtn.classList.add('has-hitpose');
            } else {
                scaleSliderWrapper.classList.remove('has-hitpose');
                placeElmBtn.classList.remove('has-hitpose');
                placeElmBtn.textContent = "Move your phone to map the floor";
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
        startARbtn.classList.remove('not-models-ready');
        document.body.classList.remove('not-models-ready');
    });
}

function setHomeModel() {
    var homeObj = baseModel.clone();
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
    // const scale = 0.035;
    // reticleObj.scale(scale, scale, scale);
    // reticleObj.translate(0, reticleObj.boundingBox.max.y * 0.99, 1);
    reticleObj.translate(0, reticleObj.boundingBox.max.y, 0.5);

    reticleModel = new THREE.Points(reticleObj, new THREE.PointsMaterial({
        vertexColors: THREE.VertexColors,
        size: mainModelPointSize,
        opacity: 0.5
    }));

    // scene.add(reticleModel);
    console.log('Reticle model set');
}

function setMainModel() {
    var mainObj = baseModel.clone();
    mainObj.translate(0, mainObj.boundingBox.max.y, 1);

    mainModel = new THREE.Points(mainObj, new THREE.PointsMaterial({
        vertexColors: THREE.VertexColors,
        size: mainModelPointSize
    }));

    mainModel.position.copy(reticleModel.position);
    mainModel.visible = false;

    scene.add(mainModel);
    console.log('Main model set');
}

function onWindowResize() {
    if (!renderer.xr.isPresenting) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(container.clientWidth, container.clientHeight);
    }

}

function setInitialCameraPosition() {
    camera.position.set(0, 1.5, -24);
}

function calculateRatio(num_1, num_2) {
    for (let num = num_2; num > 1; num--) {
        if ((num_1 % num) == 0 && (num_2 % num) == 0) {
            num_1 = num_1 / num;
            num_2 = num_2 / num;
        }
    }
    var ratio = num_1 + ":" + num_2;
    return ratio;
}