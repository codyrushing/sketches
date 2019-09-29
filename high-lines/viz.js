const canvasSketch = require('canvas-sketch');

// https://threejs.org/examples/?q=line#software_lines_splines
// https://threejs.org/examples/?q=line#webgl_lines_fat

// Ensure ThreeJS is in global scope for the 'examples/'
global.THREE = require('three');

export default class Viz {
  constructor(params){
    this.setup(params);
  }
  setup({ renderer }){
    this.renderer = renderer;
    // WebGL background color
    this.renderer.setClearColor('hsl(0, 0%, 85%)');
    // Setup a camera
    this.camera = new THREE.OrthographicCamera();
    // Setup your scene
    this.scene = new THREE.Scene();
    // create 1x1x1 cube geometry
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        color: 'red'
      })
    );


    this.mesh.scale.multiplyScalar(0.1);
    this.scene.add(this.mesh);    

    // add direction light white that makes some cool shadows
    this.light = new THREE.DirectionalLight('white', 1);
    this.light.position.set(
      -2,
      4,
      2
    );
    this.scene.add(this.light); 
    
    // add ambient light - soft gray
    this.scene.add(new THREE.AmbientLight('hsl(0,0,90%)'));
  }
  draw(){
      // set random position
      this.mesh.position.set(
        this.camera.right,
        0,
        0
      );

      this.mesh.rotation.x += 0.01;
      this.mesh.rotation.y += 0.01;
            
      this.renderer.render(this.scene, this.camera);
  }
}