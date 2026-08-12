import { getOpenMtpApi } from '../helpers/electronApi';

export const isGoogleAndroidFileTransferActive = async () => {
  const { isProcessRunning } = getOpenMtpApi().system;
  const isAftRunning = await isProcessRunning('Android File transfer.app');
  const isAftAgentRunning = await isProcessRunning(
    'Android File Transfer Agent.app'
  );

  return isAftRunning && isAftAgentRunning;
};
