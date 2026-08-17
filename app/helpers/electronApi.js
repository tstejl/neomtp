export const getNeoMtpApi = () => {
  if (typeof window === 'undefined' || !window.neomtp) {
    throw new Error('NeoMTP renderer API is unavailable');
  }

  return window.neomtp;
};
