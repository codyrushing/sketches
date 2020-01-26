/* 
for a given range [min, max], returns an oscillator function 
which accepts a value and returns a `t` value between 0 and 1
for example, with a range of [0, 10]: 
  * 1 returns 0.1
  * 9 return 0.9
  * 11 returns 0.9
  * 15 returns 0.5
  * 20 returns 0
*/

export const linearOscillator = ({domain}) => {
  const [ min, max ] = domain;
  const extent = max - min;
  // const midpoint = min + extent/2;
  return v => {
    v = v - min;
    const period = Math.floor(v/extent);
    const mod = (v % extent)/extent

    return period % 2
      ? 1 - mod
      : mod;
  }
}