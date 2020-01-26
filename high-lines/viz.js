const THREE = require('three');
// Ensure ThreeJS is in global scope for the 'examples/'
global.THREE = THREE;
import { MeshLine, MeshLineMaterial } from 'three.meshline';
import canvasSketch from 'canvas-sketch';
import random from 'canvas-sketch-util/random';
import * as d3Scale from 'd3-scale';
import * as d3Array from 'd3-array';
import * as d3Ease from 'd3-ease';
import * as d3Interpolate from 'd3-interpolate';
import * as d3Color from 'd3-color';
import { lerp, mapRange } from 'canvas-sketch-util/math';
import { linearOscillator } from '../utils';
import palettes from 'nice-color-palettes';

// https://threejs.org/examples/?q=line#software_lines_splines
// https://threejs.org/examples/?q=line#webgl_lines_fat

// how to incrementally render a mesh
// https://stackoverflow.com/questions/36426139/incrementally-display-three-js-tubegeometry

// how to build a circular color scale
// https://observablehq.com/@d3/d3-interpolatediscrete?collection=@d3/d3-interpolate

/*
GOOD SEEDS
678975
632377
*/
random.setSeed(random.getRandomSeed());
console.log('seed', random.getSeed());

const palette = random.pick(palettes)
  .concat(random.pick(random.shuffle(palettes)))
  .concat(random.pick(random.shuffle(palettes)))
  .concat(random.pick(random.shuffle(palettes)));

let firstLineSlotIndex = null;

export default class Viz {
  constructor(params){
    this.params = {
      LINES_COUNT: 14,
      LINE_WIDTH: 0.02,
      CURVE_SEGMENTS: 150,
      DEPTH: 50,
      ...params
    }
    this.setup(params);
  }
  setup({ renderer }){
    this.renderer = renderer;
    // WebGL background color
    this.renderer.setClearColor('hsl(0, 0%, 95%)');
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

    // https://observablehq.com/@d3/continuous-scales#scale_symlog
    const n = 0;
    const constant_e = -1;

    this.noiseScale = d3Scale.scaleSymlog()
      .domain([-(10 ** n), 10 ** n])
      .constant(10 ** constant_e);

    const deepRed = '#FF0951';
    const intermediatePurple = '#8439FF';
    const blue = '#29ACFA';
    const teal = '#00FAF4';

    this.colorScale = d3Scale.scaleLinear()
      .domain([0, 1])
      .range(['#FF388A', '#0AA1FA'])
      .interpolate(d3Interpolate.interpolateRgb)
      .clamp(true);
  }

  getNoiseMultiplier(i){
    const { CURVE_SEGMENTS } = this.params;
    const noiseConstant = 0.25;
    const midpoint = CURVE_SEGMENTS/2;
    const posValue = this.noiseScale(
      d3Scale.scaleLinear().range([-1, 1])(Math.min(i, CURVE_SEGMENTS - i) / midpoint)      
    );
    return posValue * noiseConstant;
  }

  get baseZ(){
    return (this.camera.near + this.camera.far)/2;
  }

  createPoints({ vertical, forward, pos0 }){
    const { CURVE_SEGMENTS, LINE_WIDTH } = this.params;

    random.permuteNoise();
    let edges = [0,1];
    let offset = random.pick([0,1]);
    let stackUp = random.boolean();

    const interpolateVectors = ({ vi, vf, count=1, inclusive=true}) => {      
      let r = [];
      for(let i=1; i<=count; i++){
        r.push(
          vi.clone().add(
            vf.clone().sub(vi.clone()).multiplyScalar(i/(count+1))
          )
        );
      }
      if(inclusive){
        r.unshift(vi);
        r.push(vf);
      }
      return r;
    };

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

    let noiselessZone = 0;
    let p0 = new THREE.Vector3(x0,y0,z);
    let p1 = new THREE.Vector3(x1,y1,z);
    let p0_n = p0.clone().add(
      v.clone().multiplyScalar(noiselessZone)
    );
    let p1_n = p0.clone().add(
      v.clone().multiplyScalar(1 - noiselessZone)
    );

    // add first points
    let pointGroups = interpolateVectors({vi: p0, vf: p0_n, count: 1, inclusive: true})
      .map(
        point => {
          return {
            point,
            overlappingPoints: [],
            stackUp
          };
        }
      );
    
    for(var i=0; i<CURVE_SEGMENTS; i++){
      // get next ideal point (without noise)
      let prevPointGroup = pointGroups[pointGroups.length-1];
      let prevP = prevPointGroup.point;

      // get next point
      // let p = prevP.clone()
      //   .add(
      //     p1_n.clone().sub(prevP)
      //       .divideScalar(CURVE_SEGMENTS - i)
      //   );

      let p = p0_n.clone().add(
        p1_n.clone().sub(p0_n.clone()).multiplyScalar(
          i / CURVE_SEGMENTS 
        )
      );

      const noiseFrequency = 2.5;

      let noise = vertical
        ? [random.noise2D(p.x, p.y, noiseFrequency), 0, 0 ]
        : [0, random.noise2D(p.x, p.y, noiseFrequency), 0 ];
              
      // add noise
      p
        .add(
          new THREE.Vector3(...noise).multiplyScalar(this.getNoiseMultiplier(i))
        );

      let pointGroup = { point: p };

      this.adjustPointStacking({ 
        pointGroup,
        prevPointGroup
      });

      pointGroups.push(pointGroup);
    }

    // add last points
    return pointGroups.concat(
      interpolateVectors({vi: p1_n, vf: p1, count: 10, inclusive: true})
      .map(
        point => {
          return {
            point,
            overlappingPoints: []
          }
        }
      )
    );
      

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
  createGeometry(points, { vertical, time }){
    const { CURVE_SEGMENTS } = this.params;
    // set start and end points to be just beyond the bounds of the camera/viewport system
    // so that edges are never seen
    let xPad = vertical 
      ? 0
      : (this.camera.right - this.camera.left) * 0.05;
    
    let yPad = vertical
      ? (this.camera.bottom - this.camera.top) * 0.05
      : 0;

    var geometry = new THREE.Geometry();

    let getUndulation = ({i, x}) => {
      const indexMultiplier = (
        i < CURVE_SEGMENTS/2
          ? i
          : CURVE_SEGMENTS-i
      )/(CURVE_SEGMENTS/2);
      return (x ? Math.sin : Math.cos)(i / (CURVE_SEGMENTS/3) + time) * 0.01 * indexMultiplier;
    };

    geometry.vertices = points.map(
      (p, i) => new THREE.Vector3(
        lerp(this.camera.left - xPad, this.camera.right + xPad, p.x + getUndulation({i, x: true})),
        lerp(this.camera.top - yPad, this.camera.bottom + yPad, p.y + getUndulation({i})),
        p.z
      )
    );

    return geometry;
  }

  buildLine(){
    const { LINES_COUNT, LINE_WIDTH } = this.params;

    const spawnBounds = [0.35, 0.65];
    const spawnRange = spawnBounds[1] - spawnBounds[0];
    const slotsPerSide = Math.floor(LINES_COUNT / 2);
    const slotSize = spawnRange / slotsPerSide;
    if(slotSize < LINE_WIDTH){
      console.warn('Slot size too small, lines could overlap.  Decrease LINE_WIDTH or LINES_COUNT, or increase spawn range');
    }
    
    const slots = [];
    while(slots.length < LINES_COUNT){
      let i = slots.length;
      let vertical = i < slotsPerSide;
      let slotIndex = i % slotsPerSide;
      slots.push({
        i,
        vertical,
        pos0: spawnBounds[0] + slotIndex * slotSize
      });
    }

    let availableSlots = slots.filter(
      slot => !this.lines.find(l => l.slot.i === slot.i)
    );

    // if no slots available, then reuse the first line's slot
    if(!availableSlots.length){
      availableSlots = [this.lines[0].slot];
    }

    let slot = random.pick(availableSlots);
    let { vertical } = slot;
    let forward = random.boolean();

    let pointGroups = this.createPoints({ forward, ...slot });
    let points = pointGroups.map(pg => pg.point);

    this.lines.push({
      vertical,
      points,
      color: random.pick(palette),
      renderedPoints: [],
      slot
    });      
  }

  getColor({slotIndex, time}){
    const { LINES_COUNT } = this.params;
    const oscillator = linearOscillator({ domain: [0, LINES_COUNT/2],  });
    const v = oscillator(slotIndex + time * 0.5);
    return this.colorScale(v);
  }

  draw({time}){
    const { LINE_WIDTH, LINES_COUNT } = this.params;
    const drawDurationSeconds = 3;
    const disappearingBuffer = 3;

    let currentLine = this.lines[this.lines.length - 1];
    // if all available lines have been drawn, the first line will disappear
    let lineToDisappear = this.lines.length >= LINES_COUNT - disappearingBuffer
      ? this.lines[0]
      : null;
    
    if(!currentLine || currentLine.done){
      this.buildLine();
      currentLine = this.lines[this.lines.length - 1];
      currentLine.startTime = time;
    }

    // set a disappearStartTime value on lineToDisappear
    if(lineToDisappear && !lineToDisappear.hasOwnProperty('disappearStartTime')){
      lineToDisappear.disappearStartTime = time;
    }

    this.lines.forEach(
      (line, i) => {
        const { points, vertical, color, startTime, disappearStartTime, slot } = line;
        const isCurrentLine = i === this.lines.length-1;
        const isDisappearing = !isNaN(disappearStartTime);
        const isLineToDisappear = i === 0 && this.lines.length > LINES_COUNT;

        const pointsToRender = isCurrentLine
          ? points.slice(
            0,
            Math.round(
              points.length
              *
              // d3Ease.easePolyInOut((time - startTime)/drawDurationSeconds, 2)
              d3Ease.easeQuadInOut((time - startTime)/drawDurationSeconds)
            )
          )
          : points;

        const geometry = this.createGeometry(pointsToRender, {...slot, time});
    
        const meshLine = new MeshLine();
        meshLine.setGeometry(geometry);

        const lineWidth = isDisappearing 
          ? d3Scale.scaleLinear()
            .domain([disappearStartTime, disappearStartTime + drawDurationSeconds])
            .range([LINE_WIDTH, 0])
            .clamp(true)(time)              
          : LINE_WIDTH;

        const material = new MeshLineMaterial({ 
          color: this.getColor({slotIndex: slot.i, time}),
          sizeAttenuation: false,
          lineWidth,
          near: this.camera.near,
          far: this.camera.far
        });
        
        // mark line as done if all points have been rendered
        if(pointsToRender.length >= points.length){
          line.done = true;
        }

        // if line is disappearing, 
        if(isDisappearing && lineWidth === 0){
          line.doneDisappearing = true;
        }
        
        const mesh = new THREE.Mesh( meshLine.geometry, material );
        this.scene.add(mesh);
    
        if(line.mesh){
          this.scene.remove(line.mesh);
        }
        line.mesh = mesh;
    
      }
    );

    if(lineToDisappear && lineToDisappear.doneDisappearing){
      this.scene.remove(lineToDisappear.mesh);
      this.lines.shift();
    }

    this.renderer.render(this.scene, this.camera);
  }
}