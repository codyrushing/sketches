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

const palette = random.pick(palettes)
  .concat(random.pick(random.shuffle(palettes)))
  .concat(random.pick(random.shuffle(palettes)))
  .concat(random.pick(random.shuffle(palettes)));

export default class Viz {
  constructor(params){
    this.params = {
      LINES_COUNT: 24,
      TUBE_RADIUS: 0.02,
      CURVE_SEGMENTS: 100,
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
      random.permuteNoise();
      let pos0 = random.range(0.2, 0.8);
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

      // all lines start out at the center of the depth field
      let baseZ = (this.camera.near + this.camera.far)/2;

      let v = new THREE.Vector3(vx,vy,0);

      let p0 = new THREE.Vector3(x0,y0,baseZ);
      let p1 = new THREE.Vector3(x1,y1,baseZ);

      let points = [p0];

      while (points.length < CURVE_SEGMENTS){
        // get next point
        let i = points.length;
        let p = points[i-1].clone();

        let noise = vertical
          ? [
            random.noise2D(p.x, p.y, 2),
            0,
            0
          ]
          : [
            0,
            random.noise2D(p.x, p.y, 2),
            0
          ];
          

        // get next point
        let pNext = p.clone()
          .add(
            p1.clone().sub(p)
              .divideScalar(CURVE_SEGMENTS - i)
              // add noise
              .add(
                new THREE.Vector3(...noise).multiplyScalar(
                  Math.min(i, CURVE_SEGMENTS-i) / CURVE_SEGMENTS * 0.1
                )
              )
          );

        // try to go to baseZ if not already
        // pNext.setZ(baseZ);

        let checkForOverlappingPoints = () => {
          // test to see if overlapping with any other points
          let overlappingPoints = this.lines.map(l => l.points).reduce(
            (acc, v) => {
              acc = acc.concat(v);
              return acc;
            },
            []
          )
          .map(v => v.clone())
          .filter(
            existingPoint => pNext.clone().sub(existingPoint).length() < TUBE_RADIUS*2
          );

          if(overlappingPoints.length){
            // find gaps
            let gaps = overlappingPoints.reduce(
              (acc, v0, i, arr) => {
                const partner = arr.find(v1 => v1.clone().sub(v0.clone()).length() > TUBE_RADIUS*2);
                if(partner){
                  acc.push([v0.clone(),partner.clone()]);
                }
                return acc;
              },
              []
            );
            if(false && gaps.length){
              // if there are available gaps, then try to thread a gap for a more intertwined look
              let [p0, p1] = random.shuffle(random.pick(gaps));
              pNext = p0.add(
                p1.sub(p0).normalize().multiplyScalar(TUBE_RADIUS*2)
              );              
              return checkForOverlappingPoints();
            }
            else {
              let zValues = overlappingPoints.map(p => p.z).sort();
              // no gaps, then just try to set a point that's somewhat far away from others to encourage gaps in the future
              if(random.boolean()){
                // go higher z
                pNext.setZ(
                  random.range(zValues[zValues.length-1] + TUBE_RADIUS*2, this.camera.far - TUBE_RADIUS*2) 
                );
              }
              else {
                // go lower z
                pNext.setZ(
                  random.range(this.camera.near + TUBE_RADIUS*2, zValues[0] - TUBE_RADIUS*2)
                );
              }
              return checkForOverlappingPoints();
            }
          }
        };

        checkForOverlappingPoints();

        points.push(pNext);

      }

      let xPad = vertical 
        ? 0
        : (this.camera.right - this.camera.left) * 0.05;
      
      let yPad = vertical
        ? (this.camera.bottom - this.camera.top) * 0.05
        : 0;

      let curve = new THREE.CatmullRomCurve3(
        points.map(
          p => new THREE.Vector3(
            lerp(this.camera.left - xPad, this.camera.right + xPad, p.x),
            lerp(this.camera.top - yPad, this.camera.bottom + yPad, p.y),
            p.z
          )
        )
      );

      var geometry = new THREE.TubeGeometry( curve, 100, TUBE_RADIUS, 32, false );

      this.lines.push({
        points,
        geometry,
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
        const { geometry, rendered, color } = l;
        if(!rendered){
          var material = new THREE.MeshStandardMaterial( { color } );
          var mesh = new THREE.Mesh( geometry, material );

          this.scene.add(mesh);
          l.rendered = true;  
        }
      }
    );

    this.renderer.render(this.scene, this.camera);
  }
}