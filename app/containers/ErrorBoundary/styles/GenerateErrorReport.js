import { mixins } from '../../../styles/js';

export const styles = (theme) => ({
  generateLogsBtn: {
    marginTop: 0,
    ...mixins({ theme }).btnPositive,
  },
});
