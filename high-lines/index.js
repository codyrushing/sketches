const canvasSketch = require('canvas-sketch');

// Ensure ThreeJS is in global scope for the 'examples/'
global.THREE = require('three');

const settings = {
  // Make the loop animated
  animate: true,
  // Get a WebGL canvas rather than 2D
  context: 'webgl',
  // Turn on MSAA
  attributes: { antialias: true }
};

const sketch = ({ context }) => {
  // Create a renderer
  const renderer = new THREE.WebGLRenderer({
    context
  });

  // WebGL background color
  renderer.setClearColor('hsl(0, 0%, 85%)', 1);

  // Setup a camera
  const camera = new THREE.OrthographicCamera();

  // Setup your scene
  const scene = new THREE.Scene();

  // create 1x1x1 cube geometry
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  let mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 'red'
    })
  );

  // red x
  // green y
  // blue z

  // set random position
  mesh.position.set(
    0,
    0,
    10
  );
  // scale x, y, and z coordinates by a scalar (in this case, shrinking)
  mesh.scale.multiplyScalar(0.1);
  scene.add(mesh);    

  // add direction light white that makes some cool shadows
  const light = new THREE.DirectionalLight('white', 1);
  light.position.set(
    -2,
    4,
    2
  );
  scene.add(light); 
  
  // add ambient light - soft gray
  scene.add(new THREE.AmbientLight('hsl(0,0,90%)'));  

  const axes = new THREE.AxesHelper(1);
  axes.position.set(0,0,0);
  scene.add(axes);

  // draw each frame
  return {
    // Handle resize events here
    resize ({ pixelRatio, viewportWidth, viewportHeight }) {
      /*
      MAGIC CODE SNIPPET THAT KEEPS CAMERA POSITIONED PROPERLY ON RESIZE
      */
      // this is an orthographic camera setup
      // this is nice because it matches the viewport, and sets zoom to 1
      // for x, -1 is the left edge of the viewport, 1 is the right
      // for y, -1 is the bottom edge of the viewport, 1 is the top
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(viewportWidth, viewportHeight);
      const aspect = viewportWidth / viewportHeight;

      // Ortho zoom
      const zoom = 1;

      // Bounds
      camera.left = -zoom * aspect;
      camera.right = zoom * aspect;
      camera.top = zoom;
      camera.bottom = -zoom;

      // Near/Far
      camera.near = -100;
      camera.far = 100;

      // Set position & look at world center
      // put it at zero      
      camera.position.set(
        0, //zoom, 
        0, // zoom, 
        0, //zoom
      );
      camera.lookAt(new THREE.Vector3(0,0,0));

      // Update the camera
      camera.updateProjectionMatrix();
    },
    // Update & render your scene here
    render ({ time }) {
      renderer.render(scene, camera);
    },
    // Dispose of events & renderer for cleaner hot-reloading
    unload () {
      renderer.dispose();
    }
  };
};

canvasSketch(sketch, settings);