import Viz from './viz';
import Stats from 'stats.js';
const canvasSketch = require('canvas-sketch');

// https://threejs.org/examples/?q=line#software_lines_splines
// https://threejs.org/examples/?q=line#webgl_lines_fat

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

  const stats = new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  const viz = new Viz({ renderer });

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
      const { renderer, camera } = viz;
      
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
      camera.near = -500;
      camera.far = 500;

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
      stats.begin();
      viz.draw({ time });
      stats.end();
    },
    // Dispose of events & renderer for cleaner hot-reloading
    unload () {
      renderer.dispose();
    }
  };
};

canvasSketch(sketch, settings);