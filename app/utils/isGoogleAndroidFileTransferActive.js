import { getNeoMtpApi } from '../helpers/electronApi';

export const isGoogleAndroidFileTransferActive = async () => {
  const { isProcessRunning } = getNeoMtpApi().system;
  const isAftRunning = await isProcessRunning('Android File transfer.app');
  const isAftAgentRunning = await isProcessRunning(
    'Android File Transfer Agent.app'
  );

  return isAftRunning && isAftAgentRunning;
};
