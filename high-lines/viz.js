import { PointsMaterial } from 'three';

const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const { lerp } = require('canvas-sketch-util/math');
const palettes = require('nice-color-palettes');

// https://threejs.org/examples/?q=line#software_lines_splines
// https://threejs.org/examples/?q=line#webgl_lines_fat

// how to incrementally render a mesh
// https://stackoverflow.com/questions/36426139/incrementally-display-three-js-tubegeometry

// Ensure ThreeJS is in global scope for the 'examples/'
global.THREE = require('three');

random.setSeed(random.getRandomSeed());
console.log('seed', random.getSeed());

const palette = random.pick(palettes);

export default class Viz {
  constructor(params){
    this.params = {
      LINES_COUNT: 24,
      TUBE_RADIUS: 0.02,
      CURVE_SEGMENTS: 50,
      DEPTH: 50,
      ...params
    }
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

    // add direction light white that makes some cool shadows
    this.light = new THREE.DirectionalLight('white', 0.5);
    this.light.position.set(
      0,
      0,
      0
    );
    this.light.castShadow = true;
    this.scene.add(this.light); 
    
    // add ambient light - soft gray
    this.scene.add(new THREE.AmbientLight('hsl(0,0,90%)'));

    // other instance vars
    this.lines = [];
  }
  buildLines(){
    const { DEPTH, CURVE_SEGMENTS, TUBE_RADIUS, LINES_COUNT } = this.params;
    const buffer = 0.2;

    while(this.lines.length < LINES_COUNT){
      // create starting point, (0,0) is top left, (1,1) is bottom right
      // random.permuteNoise();
      let pos0 = random.value(TUBE_RADIUS, 1-TUBE_RADIUS);
      let pos1 = random.value(TUBE_RADIUS, 1-TUBE_RADIUS);
      let forward = random.boolean();
      let vertical = random.boolean();
      let edges = [0,1];
      let offset = random.pick([0,1]);


      if(!forward){
        edges.reverse();
      }

      // first point
      let x0 = vertical 
        ? pos0 
        : edges[0];
        let y0 = vertical 
        ? edges[0]
        : pos0;

      // last point
      let x1 = vertical
        ? pos0
        : edges[1];
        let y1 = vertical
        ? edges[1]
        : pos0;

      let vx = x1 - x0;
      let vy = y1 - y0;

      let baseAngle = Math.atan2(vy, vx);

      let z0 = random.range(0, DEPTH);
      let z1 = DEPTH - z0;

      let v = new THREE.Vector3(vx,vy,0);

      let p0 = [x0,y0,z0];
      let p1 = [x1,y1,z1];

      let points = [p0];
      let mainLinePoints = [p0];

      while (points.length < CURVE_SEGMENTS){
        // get next point
        let i = points.length;
        let p = points[i-1];
        let angleMultiplier = (i + offset) % 2
          ? 1
          : -1;

        let noise = vertical
          ? [
            random.noise2D(p[0], p[1], 2),
            0,
            0
          ]
          : [
            0,
            random.noise2D(p[0], p[1], 2),
            0
          ];
          

        // vector to next main line point
        let mainVelocity = new THREE.Vector3(...p1)
          .sub(new THREE.Vector3(...p))
          .divideScalar(CURVE_SEGMENTS - i)
          // add noise
          .add(
            new THREE.Vector3(...noise).multiplyScalar(
              Math.min(i, CURVE_SEGMENTS-i) / CURVE_SEGMENTS * 0.1
            )
          );
        
        let nextPointOnMainLine = new THREE.Vector3(...p).add(mainVelocity);

        points.push(
          nextPointOnMainLine.toArray()
        );

      }

      this.lines.push({
        points,
        v,
        color: random.pick(palette),
        rendered: 0
      });
    }

  }
  draw(){
    const { TUBE_RADIUS } = this.params;
    this.buildLines();
    this.lines.forEach(
      (l, i) => {
        const { rendered, color } = l;
        if(!rendered){
          let xPad = (this.camera.right - this.camera.left) * 0.1;
          let yPad = (this.camera.bottom - this.camera.top) * 0.1;

          let curve = new THREE.CatmullRomCurve3(
            l.points.map(
              p => new THREE.Vector3(
                lerp(this.camera.left - xPad, this.camera.right + xPad, p[0]),
                lerp(this.camera.top - yPad, this.camera.bottom + yPad, p[1]),
                p[2]
              )
            )
          );
      
          var geometry = new THREE.TubeGeometry( curve, 100, TUBE_RADIUS, 2, false );
          var material = new THREE.MeshStandardMaterial( { color } );
          var mesh = new THREE.Mesh( geometry, material );
          material.depthTest = false;
          mesh.renderOrder = i;
          this.scene.add(mesh);
          l.rendered = true;  
        }
      }
    );

    this.renderer.render(this.scene, this.camera);
  }
}