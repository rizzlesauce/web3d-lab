import { asType } from "./types";

export const backgroundRotation = asType<boolean>(true) ? 2 * Math.PI * -0.22 : 0;
export const rotatingSceneForBackgroundRotation = asType<boolean>(true) && backgroundRotation !== 0;
