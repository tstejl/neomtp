import { getOpenMtpApi } from './electronApi';

export const rendererCapabilities = getOpenMtpApi().app.getCapabilities();

export const isKalamModeSupported = () =>
  rendererCapabilities.isKalamModeSupported === true;

export const isMas = () => rendererCapabilities.isMas === true;
