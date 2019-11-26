const THREE = require('three');
// Ensure ThreeJS is in global scope for the 'examples/'
global.THREE = THREE;
import { MeshLine, MeshLineMaterial } from 'three.meshline';
import canvasSketch from 'canvas-sketch';
import random from 'canvas-sketch-util/random';
import { lerp, mapRange } from 'canvas-sketch-util/math';
import palettes from 'nice-color-palettes';

// https://threejs.org/examples/?q=line#software_lines_splines
// https://threejs.org/examples/?q=line#webgl_lines_fat

// how to incrementally render a mesh
// https://stackoverflow.com/questions/36426139/incrementally-display-three-js-tubegeometry

random.setSeed(random.getRandomSeed());
console.log('seed', random.getSeed());

const palette = random.pick(palettes)
  .concat(random.pick(random.shuffle(palettes)))
  .concat(random.pick(random.shuffle(palettes)))
  .concat(random.pick(random.shuffle(palettes)));

export default class Viz {
  constructor(params){
    this.params = {
      LINES_COUNT: 18,
      LINE_WIDTH: 0.03,
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
    // this.light = new THREE.DirectionalLight('white', 0.5);
    // this.light.position.set(
    //   0,
    //   0,
    //   0
    // );
    // this.light.castShadow = true;
    // this.scene.add(this.light); 
    
    // add ambient light - soft gray
    this.scene.add(new THREE.AmbientLight('hsl(0,0,90%)'));

    // other instance vars
    this.lines = [];
  }

  get baseZ(){
    return (this.camera.near + this.camera.far)/2;
  }

  createPoints({ vertical, forward }){
    const { CURVE_SEGMENTS, LINE_WIDTH } = this.params;
    // create starting point, (0,0) is top left, (1,1) is bottom right
    random.permuteNoise();
    let pos0 = random.range(0.3, 0.7);
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

    let z = this.baseZ;

    // let baseAngle = Math.atan2(vy, vx);

    let v = new THREE.Vector3(vx,vy,0);

    let p0 = new THREE.Vector3(x0,y0,z);
    let p1 = new THREE.Vector3(x1,y1,z);

    let pointGroups = [{
      point: p0,
      overlappingPoints: [],
      stackUp: random.boolean()
    }];

    while (pointGroups.length < CURVE_SEGMENTS){
      // get next point
      let i = pointGroups.length;
      let prevPointGroup = pointGroups[i-1];
      let pPrev = prevPointGroup.point;

      let noise = vertical
        ? [random.noise2D(pPrev.x, pPrev.y, 2), 0, 0 ]
        : [0, random.noise2D(pPrev.x, pPrev.y, 2), 0 ];

      let distanceFromNearestEdge = Math.min(i, CURVE_SEGMENTS - i);

      let noiseBuffer = Math.round(CURVE_SEGMENTS * 0.1);

      let noiseMultiplier = mapRange(
        distanceFromNearestEdge,
        noiseBuffer, CURVE_SEGMENTS - noiseBuffer,
        0, 0.05,
        true
      );
        
      // get next point
      let p = pPrev.clone()
        .add(
          p1.clone().sub(pPrev)
            .divideScalar(CURVE_SEGMENTS - i)
        );

      // let p = p0.clone().add(
      //   p1.clone().sub(p0.clone()).multiplyScalar(
      //     i / CURVE_SEGMENTS 
      //   )
      // );
      
      // add noise
      p
        .add(
          new THREE.Vector3(...noise).multiplyScalar(noiseMultiplier)
        );

      let pointGroup = { point: p };

      this.adjustPointStacking({ 
        pointGroup,
        prevPointGroup
      });

      pointGroups.push(pointGroup);
    }

    return pointGroups.map(pg => pg.point);
  }

  adjustPointStacking({pointGroup, prevPointGroup}){
    const { LINE_WIDTH } = this.params;
    const p = pointGroup.point;
    const collisionThreshold = LINE_WIDTH * 1.5;
    const allOtherPoints = this.lines.map(l => l.points).reduce(
      (acc, v) => {
        acc = acc.concat(v);
        return acc;
      },
      []
    );

    pointGroup.overlappingPoints = allOtherPoints            
      .filter(
        existingPoint => new THREE.Vector2(p.x, p.y)
          .sub(new THREE.Vector2(existingPoint.x, existingPoint.y))
          .length() < collisionThreshold
      );
    
    const prevZs = prevPointGroup.overlappingPoints.map(v => v.z).sort();
    const currentZs = pointGroup.overlappingPoints.map(v => v.z).sort();

    pointGroup.stackUp = prevPointGroup.stackUp;

    // no change, use z from prev point
    if(JSON.stringify(prevZs) === JSON.stringify(currentZs)){
      pointGroup.point.setZ(prevPointGroup.point.z);
      return;
    }

    // no overlapping points, so go back to base, and flip stacking order for future stacks
    if(!pointGroup.overlappingPoints.length){
      pointGroup.point.setZ(this.baseZ);
      pointGroup.stackUp = !pointGroup.stackUp;
      return;
    }

    // stack point up or down depending on `stackUp` property
    pointGroup.point.setZ(
      pointGroup.stackUp
        ? currentZs[currentZs.length-1] + collisionThreshold
        : currentZs[0] - collisionThreshold
    );

  }

  // takes points which are in 0..1 scale and scales them to match the viewport 
  // and returns a line geometry
  createGeometry(points, { vertical }){
    // set start and end points to be just beyond the bounds of the camera/viewport system
    // so that edges are never seen
    let xPad = vertical 
      ? 0
      : (this.camera.right - this.camera.left) * 0.05;
    
    let yPad = vertical
      ? (this.camera.bottom - this.camera.top) * 0.05
      : 0;

    var geometry = new THREE.Geometry();
    geometry.vertices = points.map(
      p => new THREE.Vector3(
        lerp(this.camera.left - xPad, this.camera.right + xPad, p.x),
        lerp(this.camera.top - yPad, this.camera.bottom + yPad, p.y),
        p.z
      )
    );

    return geometry;
  }

  buildLines(){
    const { LINES_COUNT } = this.params;

    while(this.lines.length < LINES_COUNT){
      let vertical = random.boolean(); 
      let forward = random.boolean();
      let points = this.createPoints({ forward, vertical });
      let geometry = this.createGeometry(points, { vertical });

      this.lines.push({
        vertical,
        points,
        geometry,
        color: random.pick(palette),
        rendered: 0
      });
    }

  }
  draw(){
    const { LINE_WIDTH } = this.params;

    this.buildLines();    
    this.lines.forEach(
      (l, i) => {
        const { geometry, rendered, vertical, color } = l;
        if(!rendered){        
          const meshLine = new MeshLine();
          meshLine.setGeometry(geometry);

          const material = new MeshLineMaterial({ 
            color,
            sizeAttenuation: true,
            lineWidth: LINE_WIDTH,
            near: this.camera.near,
            far: this.camera.far
          });
          const mesh = new THREE.Mesh( meshLine.geometry, material );
          this.scene.add(mesh);
          l.rendered = true;  
        }
      }
    );

    this.renderer.render(this.scene, this.camera);
  }
}