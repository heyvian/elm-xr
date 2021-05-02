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

var overlay = document.querySelector( '.js-ar-overlay' );
var startARbtn = document.querySelector('.js-start-webxr');
var closeARbtn = document.querySelector('.js-close-webxr');
var placeElmBtn = document.querySelector('.js-place-elm');

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

    session = { requiredFeatures: ['local-floor', 'hit-test'] };

    if ( session.domOverlay === undefined ) {

        overlay = document.querySelector( '.js-ar-overlay' );

        if ( session.optionalFeatures === undefined ) {

            session.optionalFeatures = [];

        }

        session.optionalFeatures.push( 'dom-overlay' );
        session.domOverlay = { root: overlay };

    }

    startARbtn.addEventListener('click', e => {
        if ( currentSession === null ) {
            navigator.xr.requestSession( 'immersive-ar', session ).then( onSessionStarted );
        }
    });

    closeARbtn.addEventListener('click', e => {
        currentSession.end();
    });

    placeElmBtn.addEventListener('click', e => {
        if (renderer.xr.isPresenting) {
            if (mainModel) {
                mainModel.visible = true;
                mainModel.position.copy(reticleModel.position);
            }
        }
    });

    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    loadBaseModel();

    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();
}

async function onSessionStarted(session) {
    session.addEventListener( 'end', onSessionEnded );
    console.log('Session started: ', session);
    
    await renderer.xr.setSession( session );
    currentSession = session;

    XRcamera = new THREE.PerspectiveCamera();
    XRcamera.matrixAutoUpdate = false;

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
    currentSession.removeEventListener( 'end', onSessionEnded );
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
    const scale = 0.035;
    reticleObj.scale(scale, scale, scale);

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