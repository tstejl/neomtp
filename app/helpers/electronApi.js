export const getOpenMtpApi = () => {
  if (typeof window === 'undefined' || !window.openmtp) {
    throw new Error('OpenMTP renderer API is unavailable');
  }

  return window.openmtp;
};
