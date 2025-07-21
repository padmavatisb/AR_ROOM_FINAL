import "./App.css"; 
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { XREstimatedLight } from "three/examples/jsm/webxr/XREstimatedLight";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";

function App() {
  let scene, camera, renderer, reticle, controller, transformControl;
  let hitTestSource = null;
  let hitTestSourceRequested = false;
  let items = [];
  let itemSelectedIndex = 0;
  let selectedModel = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let lastTouch = 0;
  let lastTouchPositions = [];
  let initialPinchDistance = null;

  const models = [
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

  const modelScaleFactor = [0.01, 0.01, 0.005, 0.01, 0.01, 0.1, 0.1, 0.1, 0.1, 0.1];

  init();
  setupFurnitureSelection();
  animate();

  function init() {
    let myCanvas = document.getElementById("canvas");

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
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
    renderer.setSize(window.innerWidth, window.innerHeight);
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

    document.body.appendChild(
      ARButton.createButton(renderer, {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "light-estimation"],
        domOverlay: { root: document.body },
      })
    );

    const loader = new GLTFLoader();
    for (let i = 0; i < models.length; i++) {
      loader.load(models[i], (glb) => {
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

    transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener("dragging-changed", (event) => {
      renderer.xr.enabled = !event.value;
    });
    scene.add(transformControl);

    const modeSelect = document.createElement("select");
    modeSelect.style.position = "absolute";
    modeSelect.style.bottom = "10px";
    modeSelect.style.left = "10px";
    modeSelect.style.zIndex = 100;
    ["translate", "rotate", "scale"].forEach((mode) => {
      const option = document.createElement("option");
      option.value = mode;
      option.innerText = mode;
      modeSelect.appendChild(option);
    });
    modeSelect.addEventListener("change", () => {
      transformControl.setMode(modeSelect.value);
    });
    document.body.appendChild(modeSelect);

    window.addEventListener("pointerdown", (event) => {
      const now = new Date().getTime();
      if (now - lastTouch < 300) {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
          let object = intersects[0].object;
          while (object.parent && !items.includes(object)) {
            object = object.parent;
          }
          if (items.includes(object)) {
            selectedModel = object;
            transformControl.attach(selectedModel);
          }
        }
      }
      lastTouch = now;
    });

    myCanvas.addEventListener("touchstart", onTouchStart, false);
    myCanvas.addEventListener("touchmove", onTouchMove, false);
    myCanvas.addEventListener("touchend", onTouchEnd, false);
  }

  function onTouchStart(event) {
    if (!selectedModel) return;
    if (event.touches.length === 2) {
      initialPinchDistance = getTouchDistance(event.touches);
    } else if (event.touches.length === 1) {
      lastTouchPositions[0] = {
        x: event.touches[0].pageX,
        y: event.touches[0].pageY,
      };
    }
  }

  function onTouchMove(event) {
    if (!selectedModel) return;
    if (event.touches.length === 1 && lastTouchPositions[0]) {
      const dx = event.touches[0].pageX - lastTouchPositions[0].x;
      const dy = event.touches[0].pageY - lastTouchPositions[0].y;
      selectedModel.position.x += dx * 0.0005;
      selectedModel.position.z += dy * 0.0005;
      lastTouchPositions[0] = {
        x: event.touches[0].pageX,
        y: event.touches[0].pageY,
      };
    } else if (event.touches.length === 2) {
      const newDistance = getTouchDistance(event.touches);
      const scaleChange = newDistance / initialPinchDistance;
      selectedModel.scale.multiplyScalar(scaleChange);
      initialPinchDistance = newDistance;
    }
  }

  function onTouchEnd() {
    lastTouchPositions = [];
    initialPinchDistance = null;
  }

  function getTouchDistance(touches) {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
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
      selectedModel = newModel;
      transformControl.attach(selectedModel);
    }
  }

  function onClicked(e, model, index) {
    itemSelectedIndex = index;
    for (let i = 0; i < models.length; i++) {
      const el = document.querySelector(`#item` + i);
      el?.classList.remove("clicked");
    }
    e.target.classList.add("clicked");
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

      if (!hitTestSourceRequested) {
        session.requestReferenceSpace("viewer").then((refSpace) => {
          session.requestHitTestSource({ space: refSpace }).then((source) => {
            hitTestSource = source;
          });
        });

        session.addEventListener("end", () => {
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
