import "./App.css";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { XREstimatedLight } from "three/examples/jsm/webxr/XREstimatedLight";

function App() {
  let reticle;
  let hitTestSource = null;
  let hitTestSourceRequested = false;

  let scene, camera, renderer;
  let selectedModel = null;
  let isDragging = false;
  let lastTouchDistance = 0;

  let models = [
    "./dylan_armchair_yolk_yellow.glb",
    "./ivan_armchair_mineral_blue.glb",
    "./marble_coffee_table.glb",
    "./flippa_functional_coffee_table_w._storagewalnut.glb",
    "./frame_armchairpetrol_velvet_with_gold_frame.glb",
    "./elnaz_nesting_side_tables_brass__green_marble.glb",
    "Standing_lamp.glb",
    "Dining_Set.glb",
    "Little_Bookcase.glb",
    "Plant_Decor.glb"
  ];
  let modelScaleFactor = [0.01, 0.01, 0.005, 0.01, 0.01, 0.1, 0.1, 0.1, 0.1, 0.1];
  let items = [];
  let itemSelectedIndex = 0;

  let controller;

  init();
  setupFurnitureSelection();
  animate();

  function init() {
    let myCanvas = document.getElementById("canvas");
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      70,
      myCanvas.innerWidth / myCanvas.innerHeight,
      0.01,
      20
    );

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({
      canvas: myCanvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(myCanvas.innerWidth, myCanvas.innerHeight);
    renderer.xr.enabled = true;

    const xrLight = new XREstimatedLight(renderer);
    xrLight.addEventListener("estimationstart", () => {
      scene.add(xrLight);
      scene.remove(light);
      if (xrLight.environment) {
        scene.environment = xrLight.environment;
      }
    });

    xrLight.addEventListener("estimationend", () => {
      scene.add(light);
      scene.remove(xrLight);
    });

    let arButton = ARButton.createButton(renderer, {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "light-estimation"],
      domOverlay: { root: document.body },
    });
    arButton.style.bottom = "20%";
    document.body.appendChild(arButton);

    for (let i = 0; i < models.length; i++) {
      const loader = new GLTFLoader();
      loader.load(models[i], function (glb) {
        let model = glb.scene;
        items[i] = model;
      });
    }

    controller = renderer.xr.getController(0);
    controller.addEventListener("select", onSelect);
    scene.add(controller);

    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
  }

  function onClicked(e, selectItem, index) {
    itemSelectedIndex = index;
    for (let i = 0; i < models.length; i++) {
      const el = document.querySelector(`#item` + i);
      el?.classList.remove("clicked");
    }
    e.target.classList.add("clicked");
  }

  function onSelect() {
    if (reticle.visible) {
      let newModel = items[itemSelectedIndex].clone();
      newModel.visible = true;

      reticle.matrix.decompose(
        newModel.position,
        newModel.quaternion,
        newModel.scale
      );
      let scaleFactor = modelScaleFactor[itemSelectedIndex];
      newModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

      scene.add(newModel);
      addGestureListeners(newModel);
    }
  }

  function addGestureListeners(model) {
    selectedModel = model;
    const domElement = renderer.domElement;

    domElement.addEventListener("touchstart", (event) => {
      if (event.touches.length === 1) {
        isDragging = true;
      }

      if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        lastTouchDistance = Math.hypot(dx, dy);
      }
    });

    domElement.addEventListener("touchmove", (event) => {
      if (!selectedModel) return;

      if (event.touches.length === 1 && isDragging) {
        const touch = event.touches[0];
        let deltaX = touch.movementX || 0.01;
        let deltaZ = touch.movementY || 0.01;

        selectedModel.position.x += deltaX * 0.001;
        selectedModel.position.z += deltaZ * 0.001;
      }

      if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const currentDistance = Math.hypot(dx, dy);

        const scaleFactor = currentDistance / lastTouchDistance;
        selectedModel.scale.multiplyScalar(scaleFactor);
        lastTouchDistance = currentDistance;
      }
    });

    domElement.addEventListener("touchend", () => {
      isDragging = false;
    });

    domElement.addEventListener("dblclick", () => {
      if (selectedModel) {
        selectedModel.rotation.y += Math.PI / 2;
      }
    });
  }

  function setupFurnitureSelection() {
    for (let i = 0; i < models.length; i++) {
      const el = document.querySelector(`#item` + i);
      el?.addEventListener("beforexrselect", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      el?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClicked(e, items[i], i);
      });
    }
  }

  function animate() {
    renderer.setAnimationLoop(render);
  }

  function render(timestamp, frame) {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      if (hitTestSourceRequested === false) {
        session.requestReferenceSpace("viewer").then(function (referenceSpace) {
          session
            .requestHitTestSource({ space: referenceSpace })
            .then(function (source) {
              hitTestSource = source;
            });
        });

        session.addEventListener("end", function () {
          hitTestSourceRequested = false;
          hitTestSource = null;
        });

        hitTestSourceRequested = true;
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length) {
          const hit = hitTestResults[0];
          reticle.visible = true;
          reticle.matrix.fromArray(
            hit.getPose(referenceSpace).transform.matrix
          );
        } else {
          reticle.visible = false;
        }
      }
    }

    renderer.render(scene, camera);
  }

  return <canvas id="canvas" className="App" />;
}

export default App;
