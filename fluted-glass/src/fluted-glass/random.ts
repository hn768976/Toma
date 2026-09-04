// mulberry32. Remotion renders frames out of order across worker threads, so
// nothing may depend on Math.random() or on state carried between frames.
// Every "random" quantity here is a pure function of an index and a salt.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededRandom = (index: number, salt: number) =>
  mulberry32(index * 9781 + salt * 6151 + 1)();
