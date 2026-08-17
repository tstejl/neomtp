import { getNeoMtpApi } from './electronApi';

export const rendererCapabilities = getNeoMtpApi().app.getCapabilities();

export const isKalamModeSupported = () =>
  rendererCapabilities.isKalamModeSupported === true;

export const isMas = () => rendererCapabilities.isMas === true;
