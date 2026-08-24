import { mixins } from '../../../styles/js';

export const styles = (theme) => ({
  root: {
    width: '100%',
    ...mixins({ theme }).noselect,
  },
  tableWrapper: {
    ...mixins({ theme }).noOutline,
    height: `calc(100vh - 120px)`,
    position: 'relative',
    overflowY: 'auto',
    overflowX: 'auto',
    borderBottom: `solid 1px ${theme.palette.fileExplorerThinLineDividerColor}`,
    borderLeft: `solid 1px ${theme.palette.fileExplorerThinLineDividerColor}`,
    [`&.onHoverDropZone`]: {
      backgroundColor: theme.palette.fileDrop,
    },
    [`&.statusBarActive`]: {
      height: `calc(100vh - 150px) !important`,
    },
  },
  selectionMarquee: {
    position: 'fixed',
    zIndex: 2,
    border: `1px solid ${theme.palette.secondary.main}`,
    backgroundColor: 'rgba(0, 122, 245, 0.18)',
    pointerEvents: 'none',
  },
});
