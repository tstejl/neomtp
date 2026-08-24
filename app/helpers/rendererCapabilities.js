import { getNeoMtpApi } from './electronApi';

export const rendererCapabilities = getNeoMtpApi().app.getCapabilities();

export const isMas = () => rendererCapabilities.isMas === true;
