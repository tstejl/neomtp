import React, { PureComponent } from 'react';
import { withStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import classNames from 'classnames';
import hotkeys from 'hotkeys-js';
import FileExplorerTableBodyRender from './FileExplorerTableBodyRender';
import FileExplorerTableFooterRender from './FileExplorerTableFooterRender';
import { styles } from '../styles/FileExplorerBodyRender';
import { fileExplorerKeymaps } from '../../../constants/keymaps';
import {
  isFileExplorerOnFocus,
  toggleFileExplorerDeviceType,
  undefinedOrNull,
} from '../../../utils/funcs';
import { FILE_EXPLORER_DEFAULT_FOCUSSED_DEVICE_TYPE } from '../../../constants';
import { FILE_EXPLORER_BODY_WRAPPER_ID } from '../../../constants/dom';
import { DEVICE_TYPE } from '../../../enums';

const MARQUEE_DRAG_THRESHOLD = 4;
const MARQUEE_AUTO_SCROLL_EDGE = 32;
const MARQUEE_AUTO_SCROLL_SPEED = 16;

class FileExplorerBodyRender extends PureComponent {
  constructor(props) {
    super(props);
    const { deviceType } = this.props;

    this.fileExplorerKeymapString = null;
    this.focussedFileExplorerDeviceTypeCached =
      FILE_EXPLORER_DEFAULT_FOCUSSED_DEVICE_TYPE;
    this.fileExplorerBodyWrapperId = `${FILE_EXPLORER_BODY_WRAPPER_ID}-${deviceType}`;
    this.acceleratorIgnoreList = ['multipleSelectClick'];
    this.marqueeInteraction = null;
    this.marqueeAnimationFrame = null;
    this.state = {
      marquee: null,
    };
  }

  componentDidMount() {
    this.accelerators();
    this.focusItem();

    this.fileExplorerBodyWrapper = document.getElementById(
      this.fileExplorerBodyWrapperId
    );
  }

  componentWillUnmount() {
    this._stopMarqueeSelection({ reset: false });
    hotkeys.unbind(this.fileExplorerKeymapString);
  }

  _isMarqueeBlockedTarget = (target) => {
    if (!target || typeof target.closest !== 'function') {
      return true;
    }

    return Boolean(
      target.closest(
        '[data-file-entry], input, button, a, select, textarea, [role="button"], thead, th, [contenteditable="true"]'
      )
    );
  };

  _isMarqueePointerInViewport = (event) => {
    if (!this.fileExplorerBodyWrapper) {
      return false;
    }

    const wrapperRect = this.fileExplorerBodyWrapper.getBoundingClientRect();
    const left = wrapperRect.left + this.fileExplorerBodyWrapper.clientLeft;
    const top = wrapperRect.top + this.fileExplorerBodyWrapper.clientTop;

    return (
      event.clientX >= left &&
      event.clientX < left + this.fileExplorerBodyWrapper.clientWidth &&
      event.clientY >= top &&
      event.clientY < top + this.fileExplorerBodyWrapper.clientHeight
    );
  };

  _getMarqueeContentPoint = (event, wrapperRect) => ({
    x:
      event.clientX -
      wrapperRect.left +
      this.fileExplorerBodyWrapper.scrollLeft,
    y: event.clientY - wrapperRect.top + this.fileExplorerBodyWrapper.scrollTop,
  });

  _getMarqueeBounds = (start, end) => ({
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  });

  _areSelectionsEqual = (left, right) =>
    left.length === right.length &&
    left.every((path, index) => path === right[index]);

  _getMarqueeSelection = (bounds, wrapperRect) => {
    const entries = Array.from(
      this.fileExplorerBodyWrapper.querySelectorAll(
        '[data-file-entry][data-file-path]'
      )
    );
    const selectedPaths = [];

    entries.forEach((entry) => {
      const entryRect = entry.getBoundingClientRect();

      if (entryRect.width <= 0 || entryRect.height <= 0) {
        return;
      }

      const entryBounds = {
        left:
          entryRect.left -
          wrapperRect.left +
          this.fileExplorerBodyWrapper.scrollLeft,
        top:
          entryRect.top -
          wrapperRect.top +
          this.fileExplorerBodyWrapper.scrollTop,
        right:
          entryRect.right -
          wrapperRect.left +
          this.fileExplorerBodyWrapper.scrollLeft,
        bottom:
          entryRect.bottom -
          wrapperRect.top +
          this.fileExplorerBodyWrapper.scrollTop,
      };

      if (
        entryBounds.left <= bounds.right &&
        entryBounds.right >= bounds.left &&
        entryBounds.top <= bounds.bottom &&
        entryBounds.bottom >= bounds.top
      ) {
        selectedPaths.push(entry.getAttribute('data-file-path'));
      }
    });

    return {
      entries: entries.map((entry) => entry.getAttribute('data-file-path')),
      selectedPaths,
    };
  };

  _getSelectionForMarquee = (
    entries,
    selectedPaths,
    mode,
    initialSelection
  ) => {
    const mountedEntries = [...new Set(entries)];
    const uniqueInitialSelection = [...new Set(initialSelection)];
    const selectedAtPointerDown = new Set(uniqueInitialSelection);
    const marqueeSelection = new Set(selectedPaths);

    if (mode === 'shift') {
      return [
        ...uniqueInitialSelection,
        ...mountedEntries.filter(
          (path) =>
            marqueeSelection.has(path) && !selectedAtPointerDown.has(path)
        ),
      ];
    }

    if (mode === 'toggle') {
      return [
        ...uniqueInitialSelection.filter((path) => !marqueeSelection.has(path)),
        ...mountedEntries.filter(
          (path) =>
            marqueeSelection.has(path) && !selectedAtPointerDown.has(path)
        ),
      ];
    }

    return mountedEntries.filter((path) => marqueeSelection.has(path));
  };

  _updateMarqueeSelection = () => {
    const interaction = this.marqueeInteraction;

    if (!interaction || !interaction.active || !this.fileExplorerBodyWrapper) {
      return;
    }

    const wrapperRect = this.fileExplorerBodyWrapper.getBoundingClientRect();
    const currentPoint = this._getMarqueeContentPoint(
      interaction.pointer,
      wrapperRect
    );
    const bounds = this._getMarqueeBounds(interaction.start, currentPoint);
    const { entries, selectedPaths } = this._getMarqueeSelection(
      bounds,
      wrapperRect
    );
    const nextSelection = this._getSelectionForMarquee(
      entries,
      selectedPaths,
      interaction.mode,
      interaction.initialSelection
    );
    const viewportBounds = {
      left:
        bounds.left -
        this.fileExplorerBodyWrapper.scrollLeft +
        wrapperRect.left,
      top:
        bounds.top - this.fileExplorerBodyWrapper.scrollTop + wrapperRect.top,
      right:
        bounds.right -
        this.fileExplorerBodyWrapper.scrollLeft +
        wrapperRect.left,
      bottom:
        bounds.bottom -
        this.fileExplorerBodyWrapper.scrollTop +
        wrapperRect.top,
    };
    const marquee = {
      left: Math.max(wrapperRect.left, viewportBounds.left),
      top: Math.max(wrapperRect.top, viewportBounds.top),
      width: Math.max(
        0,
        Math.min(wrapperRect.right, viewportBounds.right) -
          Math.max(wrapperRect.left, viewportBounds.left)
      ),
      height: Math.max(
        0,
        Math.min(wrapperRect.bottom, viewportBounds.bottom) -
          Math.max(wrapperRect.top, viewportBounds.top)
      ),
    };

    if (!this._areSelectionsEqual(interaction.lastSelection, nextSelection)) {
      interaction.lastSelection = nextSelection;
      const { onSelectionChange, deviceType } = this.props;

      if (typeof onSelectionChange === 'function') {
        onSelectionChange(nextSelection, deviceType);
      }
    }

    const { marquee: previousMarquee } = this.state;

    if (
      !previousMarquee ||
      previousMarquee.left !== marquee.left ||
      previousMarquee.top !== marquee.top ||
      previousMarquee.width !== marquee.width ||
      previousMarquee.height !== marquee.height
    ) {
      this.setState({ marquee });
    }
  };

  _scrollMarqueePane = () => {
    const interaction = this.marqueeInteraction;

    if (!interaction || !interaction.active || !this.fileExplorerBodyWrapper) {
      return false;
    }

    const wrapperRect = this.fileExplorerBodyWrapper.getBoundingClientRect();
    const { clientX, clientY } = interaction.pointer;
    const { scrollLeft: currentScrollLeft, scrollTop: currentScrollTop } =
      this.fileExplorerBodyWrapper;
    let scrollLeft = currentScrollLeft;
    let scrollTop = currentScrollTop;

    if (clientX < wrapperRect.left + MARQUEE_AUTO_SCROLL_EDGE) {
      scrollLeft -= MARQUEE_AUTO_SCROLL_SPEED;
    } else if (clientX > wrapperRect.right - MARQUEE_AUTO_SCROLL_EDGE) {
      scrollLeft += MARQUEE_AUTO_SCROLL_SPEED;
    }

    if (clientY < wrapperRect.top + MARQUEE_AUTO_SCROLL_EDGE) {
      scrollTop -= MARQUEE_AUTO_SCROLL_SPEED;
    } else if (clientY > wrapperRect.bottom - MARQUEE_AUTO_SCROLL_EDGE) {
      scrollTop += MARQUEE_AUTO_SCROLL_SPEED;
    }

    const maxScrollLeft = Math.max(
      0,
      this.fileExplorerBodyWrapper.scrollWidth -
        this.fileExplorerBodyWrapper.clientWidth
    );
    const maxScrollTop = Math.max(
      0,
      this.fileExplorerBodyWrapper.scrollHeight -
        this.fileExplorerBodyWrapper.clientHeight
    );

    scrollLeft = Math.max(0, Math.min(scrollLeft, maxScrollLeft));
    scrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop));

    const changed =
      scrollLeft !== this.fileExplorerBodyWrapper.scrollLeft ||
      scrollTop !== this.fileExplorerBodyWrapper.scrollTop;

    this.fileExplorerBodyWrapper.scrollLeft = scrollLeft;
    this.fileExplorerBodyWrapper.scrollTop = scrollTop;

    return changed;
  };

  _runMarqueeAnimation = () => {
    this.marqueeAnimationFrame = null;

    if (!this.marqueeInteraction || !this.marqueeInteraction.active) {
      return;
    }

    const didScroll = this._scrollMarqueePane();

    this._updateMarqueeSelection();

    if (didScroll) {
      this._scheduleMarqueeAnimation();
    }
  };

  _scheduleMarqueeAnimation = () => {
    if (this.marqueeAnimationFrame !== null) {
      return;
    }

    const requestFrame =
      window.requestAnimationFrame ||
      ((callback) => window.setTimeout(callback, 16));

    this.marqueeAnimationFrame = requestFrame(this._runMarqueeAnimation);
  };

  _bindMarqueePointerListeners = () => {
    window.addEventListener(
      'pointermove',
      this._handleMarqueePointerMove,
      true
    );
    window.addEventListener('pointerup', this._handleMarqueePointerUp, true);
    window.addEventListener(
      'pointercancel',
      this._handleMarqueePointerCancel,
      true
    );
    window.addEventListener('blur', this._handleMarqueeWindowBlur);
    window.addEventListener('keydown', this._handleMarqueeKeyDown, true);
  };

  _unbindMarqueePointerListeners = () => {
    window.removeEventListener(
      'pointermove',
      this._handleMarqueePointerMove,
      true
    );
    window.removeEventListener('pointerup', this._handleMarqueePointerUp, true);
    window.removeEventListener(
      'pointercancel',
      this._handleMarqueePointerCancel,
      true
    );
    window.removeEventListener('blur', this._handleMarqueeWindowBlur);
    window.removeEventListener('keydown', this._handleMarqueeKeyDown, true);
  };

  _startMarqueeSelection = (event) => {
    const { deviceType, directoryLists } = this.props;
    const wrapperRect = this.fileExplorerBodyWrapper.getBoundingClientRect();
    const initialSelection = [
      ...(directoryLists[deviceType]?.queue?.selected || []),
    ];
    const mode = event.shiftKey
      ? 'shift'
      : event.metaKey || event.ctrlKey
      ? 'toggle'
      : 'replace';

    this.marqueeInteraction = {
      pointerId: event.pointerId,
      start: this._getMarqueeContentPoint(event, wrapperRect),
      pointer: event,
      mode,
      initialSelection,
      lastSelection: initialSelection,
      active: false,
    };
    this._bindMarqueePointerListeners();
  };

  _handleMarqueePointerDown = (event) => {
    if (
      event.button !== 0 ||
      event.isPrimary === false ||
      event.pointerType === 'touch' ||
      this._isMarqueeBlockedTarget(event.target) ||
      !this._isMarqueePointerInViewport(event)
    ) {
      return;
    }

    this._stopMarqueeSelection();
    this._startMarqueeSelection(event);
  };

  _handleMarqueePointerMove = (event) => {
    const interaction = this.marqueeInteraction;

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    interaction.pointer = event;

    if (!interaction.active) {
      const startClientX =
        interaction.start.x -
        this.fileExplorerBodyWrapper.scrollLeft +
        this.fileExplorerBodyWrapper.getBoundingClientRect().left;
      const startClientY =
        interaction.start.y -
        this.fileExplorerBodyWrapper.scrollTop +
        this.fileExplorerBodyWrapper.getBoundingClientRect().top;
      const thresholdDistance = Math.max(
        Math.abs(event.clientX - startClientX),
        Math.abs(event.clientY - startClientY)
      );

      if (thresholdDistance < MARQUEE_DRAG_THRESHOLD) {
        return;
      }

      interaction.active = true;
      try {
        this.fileExplorerBodyWrapper.setPointerCapture(interaction.pointerId);
      } catch (error) {
        // Pointer capture is not available in some test DOMs.
      }
    }

    if (interaction.active) {
      event.preventDefault();
      this._scheduleMarqueeAnimation();
    }
  };

  _handleMarqueePointerUp = (event) => {
    const interaction = this.marqueeInteraction;

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    if (interaction.active) {
      interaction.pointer = event;
      this._updateMarqueeSelection();
      event.preventDefault();
    } else if (
      interaction.mode === 'replace' &&
      interaction.initialSelection.length > 0
    ) {
      const { onSelectionChange, deviceType } = this.props;

      onSelectionChange([], deviceType);
    }

    this._stopMarqueeSelection();
  };

  _handleMarqueePointerCancel = (event) => {
    const interaction = this.marqueeInteraction;

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    this._cancelMarqueeSelection();
  };

  _handleMarqueeLostPointerCapture = () => {
    if (this.marqueeInteraction?.active) {
      this._cancelMarqueeSelection();
    }
  };

  _handleMarqueeWindowBlur = () => {
    if (this.marqueeInteraction) {
      this._cancelMarqueeSelection();
    }
  };

  _handleMarqueeKeyDown = (event) => {
    if (event.key !== 'Escape' || !this.marqueeInteraction) {
      return;
    }

    event.preventDefault();
    this._cancelMarqueeSelection();
  };

  _cancelMarqueeSelection = () => {
    const interaction = this.marqueeInteraction;

    if (
      interaction?.active &&
      !this._areSelectionsEqual(
        interaction.lastSelection,
        interaction.initialSelection
      )
    ) {
      const { onSelectionChange, deviceType } = this.props;

      onSelectionChange(interaction.initialSelection, deviceType);
    }

    this._stopMarqueeSelection();
  };

  _stopMarqueeSelection = ({ reset = true } = {}) => {
    const interaction = this.marqueeInteraction;

    this.marqueeInteraction = null;

    this._unbindMarqueePointerListeners();

    if (this.marqueeAnimationFrame !== null) {
      const cancelFrame =
        window.cancelAnimationFrame || ((frame) => window.clearTimeout(frame));

      cancelFrame(this.marqueeAnimationFrame);
      this.marqueeAnimationFrame = null;
    }

    if (
      interaction &&
      this.fileExplorerBodyWrapper &&
      this.fileExplorerBodyWrapper.hasPointerCapture?.(interaction.pointerId)
    ) {
      try {
        this.fileExplorerBodyWrapper.releasePointerCapture(
          interaction.pointerId
        );
      } catch (error) {
        // Pointer capture may already have been released.
      }
    }

    const { marquee } = this.state;

    if (reset && marquee !== null) {
      this.setState({ marquee: null });
    }
  };

  focusItem = () => {
    const { deviceType } = this.props;

    if (FILE_EXPLORER_DEFAULT_FOCUSSED_DEVICE_TYPE === deviceType) {
      document.getElementById(this.fileExplorerBodyWrapperId).focus();
    }
  };

  accelerators = () => {
    const keymapActionsList = {
      newFolder: this.acceleratorNewFolder,
      copy: this.acceleratorCreateAction,
      copyToQueue: this.acceleratorCreateAction,
      paste: this.acceleratorCreateAction,
      delete: this.acceleratorCreateAction,
      refresh: this.acceleratorCreateAction,
      up: this.acceleratorCreateAction,
      selectAll: this.acceleratorCreateAction,
      rename: this.acceleratorRename,
      open: this.acceleratorCreateAction,
      fileExplorerTabSwitch: this.acceleratorFileExplorerTabSwitch,
      navigationRight: this.acceleratorCreateAction,
      navigationLeft: this.acceleratorCreateAction,
      navigationUp: this.acceleratorCreateAction,
      navigationDown: this.acceleratorCreateAction,
      multipleSelectLeft: this.acceleratorCreateAction,
      multipleSelectRight: this.acceleratorCreateAction,
      multipleSelectUp: this.acceleratorCreateAction,
      multipleSelectDown: this.acceleratorCreateAction,
    };

    this.fileExplorerKeymapString = Object.keys(fileExplorerKeymaps).reduce(
      (accumulator, currentKey) => {
        const itemCurrentKey = fileExplorerKeymaps[currentKey].keys;

        if (this.acceleratorIgnoreList.indexOf(currentKey) !== -1) {
          return accumulator;
        }

        if (undefinedOrNull(accumulator) || accumulator.trim() === '') {
          return itemCurrentKey.join(', ');
        }

        return `${accumulator}, ${itemCurrentKey.join(', ')}`;
      },
      ''
    );

    hotkeys(this.fileExplorerKeymapString, (event, handler) => {
      Object.keys(fileExplorerKeymaps).map((a) => {
        const item = fileExplorerKeymaps[a].keys;

        if (
          undefinedOrNull(keymapActionsList[a]) ||
          undefinedOrNull(item) ||
          item.indexOf(handler.key) === -1
        ) {
          return null;
        }

        if (this.acceleratorIgnoreList.indexOf(a) !== -1) {
          return null;
        }

        /* We check if there are any overlays and whether the file explorer is in focus else not fire keymapactions */
        if (!isFileExplorerOnFocus()) {
          return null;
        }

        return keymapActionsList[a](event, a);
      });
    });
  };

  acceleratorNewFolder = (event) => {
    const { onAcceleratorActivation, deviceType } = this.props;

    onAcceleratorActivation({
      type: 'newFolder',
      data: {
        event,
        tableData: this.tableData(),
        deviceType,
      },
    });
  };

  acceleratorRename = (event) => {
    const { onAcceleratorActivation, deviceType } = this.props;

    onAcceleratorActivation({
      type: 'rename',
      data: {
        event,
        tableData: this.tableData(),
        deviceType,
      },
    });
  };

  acceleratorFileExplorerTabSwitch = (event, type, toggle = true) => {
    const { onFocussedFileExplorerDeviceType, deviceType } = this.props;
    let _focussedFileExplorerDeviceType = null;

    if (toggle) {
      this.focussedFileExplorerDeviceTypeCached = toggleFileExplorerDeviceType(
        this.focussedFileExplorerDeviceTypeCached,
        DEVICE_TYPE
      );

      _focussedFileExplorerDeviceType =
        this.focussedFileExplorerDeviceTypeCached;
    } else {
      _focussedFileExplorerDeviceType = deviceType;
    }

    if (
      `${FILE_EXPLORER_BODY_WRAPPER_ID}-${_focussedFileExplorerDeviceType}` ===
      this.fileExplorerBodyWrapperId
    ) {
      document.getElementById(this.fileExplorerBodyWrapperId).focus();
    }

    onFocussedFileExplorerDeviceType(toggle, _focussedFileExplorerDeviceType);
  };

  acceleratorCreateAction = (event, type) => {
    const { onAcceleratorActivation, deviceType } = this.props;

    onAcceleratorActivation({
      type,
      data: {
        event,
        deviceType,
      },
    });
  };

  tableData = () => {
    const { deviceType, currentBrowsePath, directoryLists } = this.props;

    return {
      path: currentBrowsePath[deviceType],
      directoryLists: directoryLists[deviceType],
    };
  };

  isExternalFileDragged = (event) => {
    const dt = event.dataTransfer;

    return (
      dt.types &&
      (dt.types.indexOf
        ? dt.types.indexOf('Files') !== -1
        : dt.types.contains('Files'))
    );
  };

  _handleOnDragOver = (event) => {
    const { deviceType, onFilesDragOver } = this.props;

    // if an extenal file is being dragged into the screen
    // then do not activate the local pane
    // because local files can only to be transferred to a mtp device
    if (this.isExternalFileDragged(event)) {
      if (deviceType === DEVICE_TYPE.local) {
        return false;
      }
    }

    onFilesDragOver(event, {
      destinationDeviceType: deviceType,
    });
  };

  _handleOnDragEnd = (event) => {
    const { deviceType, onFilesDragEnd } = this.props;

    // if an extenal file is being dragged into the screen
    // then do not activate the local pane
    // because local files can only to be transferred to a mtp device
    if (this.isExternalFileDragged(event)) {
      if (deviceType === DEVICE_TYPE.local) {
        return false;
      }
    }

    onFilesDragEnd(event, {
      destinationDeviceType: deviceType,
    });
  };

  _handleOnDrop = (event) => {
    event.preventDefault();

    const { deviceType, onFilesDrop } = this.props;

    onFilesDrop(event, {
      destinationDeviceType: deviceType,
      externalFiles: event?.dataTransfer?.files ?? [],
    });
  };

  _handleExternalFileDragLeave = (event) => {
    event.preventDefault();
    const { deviceType, onExternalFileDragLeave } = this.props;

    if (this.isExternalFileDragged(event)) {
      if (deviceType === DEVICE_TYPE.local) {
        return false;
      }

      // prevent dragleave being fired when hovering a child element
      const rect = this.fileExplorerBodyWrapper.getBoundingClientRect();

      if (
        event.clientY < rect.top ||
        event.clientY >= rect.bottom ||
        event.clientX < rect.left ||
        event.clientX >= rect.right
      ) {
        onExternalFileDragLeave(event, { deviceType });
      }
    }

    return false;
  };

  render() {
    const {
      classes: styles,
      deviceType,
      currentBrowsePath,
      onHoverDropZoneActivate,
      filesDrag, // eslint-disable-line no-unused-vars
      onContextMenuClick,
      onBreadcrumbPathClick,
      isStatusBarEnabled,
      fileTransferClipboard,
      mtpDevice,
      ...parentProps
    } = this.props;
    const { directoryLists } = this.props;
    const { marquee } = this.state;

    const _eventTarget = 'tableWrapperTarget';

    return (
      <Paper
        onClick={(event) =>
          this.acceleratorFileExplorerTabSwitch(
            event,
            'fileExplorerTabSwitch',
            false
          )
        }
        className={styles.root}
        elevation={0}
        square
      >
        <div
          tabIndex={-1}
          id={this.fileExplorerBodyWrapperId}
          className={classNames(styles.tableWrapper, {
            [`onHoverDropZone`]: onHoverDropZoneActivate(deviceType),
            [`statusBarActive`]: isStatusBarEnabled,
          })}
          onContextMenu={(event) =>
            onContextMenuClick(event, {}, { ...this.tableData() }, _eventTarget)
          }
          onDragOver={this._handleOnDragOver}
          onDragEnd={this._handleOnDragEnd}
          onDrop={this._handleOnDrop}
          onDragLeave={this._handleExternalFileDragLeave}
          onPointerDown={this._handleMarqueePointerDown}
          onLostPointerCapture={this._handleMarqueeLostPointerCapture}
        >
          <FileExplorerTableBodyRender
            tableData={this.tableData()}
            deviceType={deviceType}
            currentBrowsePath={currentBrowsePath}
            onContextMenuClick={onContextMenuClick}
            mtpDevice={mtpDevice}
            {...parentProps}
          />
          {marquee && (
            <div
              aria-hidden="true"
              data-marquee-selection-box="true"
              className={styles.selectionMarquee}
              style={marquee}
            />
          )}
        </div>
        <FileExplorerTableFooterRender
          deviceType={deviceType}
          currentBrowsePath={currentBrowsePath}
          onBreadcrumbPathClick={onBreadcrumbPathClick}
          isStatusBarEnabled={isStatusBarEnabled}
          directoryLists={directoryLists[deviceType]}
          fileTransferClipboard={fileTransferClipboard}
          mtpDevice={mtpDevice}
        />
      </Paper>
    );
  }
}

export default withStyles(styles)(FileExplorerBodyRender);
