import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// Fetches a JSON file from public/ behind delayRender.
export const useStaticJson = <T,>(file: string): T | null => {
  const [data, setData] = useState<T | null>(null);
  const [handle] = useState(() => delayRender(`Loading ${file}`));
  useEffect(() => {
    fetch(staticFile(file))
      .then((r) => r.json())
      .then((j: T) => {
        setData(j);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [file, handle]);
  return data;
};

const fontPromises = new Map<string, Promise<void>>();

// Loads an OFL font from public/fonts behind delayRender. Returns true once usable.
export const useFont = (family: string, file: string): boolean => {
  const [ok, setOk] = useState(false);
  const [handle] = useState(() => delayRender(`Loading font ${family}`));
  useEffect(() => {
    let p = fontPromises.get(family);
    if (!p) {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)})`);
      p = face.load().then((f) => {
        document.fonts.add(f);
      });
      fontPromises.set(family, p);
    }
    p.then(() => {
      setOk(true);
      continueRender(handle);
    }).catch((e) => cancelRender(e));
  }, [family, file, handle]);
  return ok;
};
