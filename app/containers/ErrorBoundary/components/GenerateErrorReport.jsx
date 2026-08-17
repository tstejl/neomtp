import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { withStyles } from '@material-ui/core/styles';
import { styles } from '../styles/GenerateErrorReport';
import { APP_GITHUB_ISSUES_URL } from '../../../constants/meta';
import { throwAlert } from '../../Alerts/actions';
import { reportGenerateError } from '../../../templates/generateErrorReport';
import GenerateErrorReportBody from './GenerateErrorReportBody';
import { log } from '../../../utils/rendererLog';
import { DEVICE_TYPE } from '../../../enums';
import { IpcEvents } from '../../../services/ipc-events/IpcEventType';
import { getNeoMtpApi } from '../../../helpers/electronApi';

const neomtp = getNeoMtpApi();

const { zippedLogFileBaseName, logFileZippedPath } = neomtp.report.getInfo();

class GenerateErrorReport extends PureComponent {
  componentWillUnmount() {
    neomtp.ipc.removeListener(
      IpcEvents.REPORT_BUGS_DISPOSE_MTP_REPLY_FROM_MAIN,
      this._reportBugsDisposeMtpReplyEvent
    );
  }

  compressLog = async () => {
    try {
      return await neomtp.report.compressLog();
    } catch (e) {
      log.error(e, `GenerateErrorReport -> compressLog`);
    }
  };

  _reportBugsDisposeMtpReplyEvent = async (_, { error }) => {
    await this.startGeneratingReport({ error });
  };

  _handleGenerateErrorLogs = async () => {
    try {
      const { isReportBugsPage } = this.props;

      // if the generate button click action originated from the 'report bugs' page then use ipc channels to communicate
      // else use direct method click
      if (isReportBugsPage) {
        neomtp.ipc.send(IpcEvents.REPORT_BUGS_DISPOSE_MTP, {
          logFileZippedPath,
        });

        neomtp.ipc.once(
          IpcEvents.REPORT_BUGS_DISPOSE_MTP_REPLY_FROM_MAIN,
          this._reportBugsDisposeMtpReplyEvent
        );

        return;
      }

      // direct button click action if the generate button is within the error boundary
      await neomtp.fileExplorer.dispose({ deviceType: DEVICE_TYPE.mtp });

      await neomtp.fileExplorer.fetchDebugReport({
        deviceType: DEVICE_TYPE.mtp,
      });

      const { error } = await neomtp.fileExplorer.deleteFiles({
        deviceType: DEVICE_TYPE.local,
        fileList: [logFileZippedPath],
        storageId: null,
      });

      await this.startGeneratingReport({ error });
    } catch (e) {
      log.error(e, `GenerateErrorReport -> generateErrorLogs`);
    }
  };

  startGeneratingReport = async ({ error }) => {
    const { actionCreateThrowError } = this.props;

    if (error) {
      actionCreateThrowError({
        message: reportGenerateError,
      });

      log.error(error, reportGenerateError);

      return null;
    }

    const compressResult = await this.compressLog();

    if (compressResult?.error || !compressResult?.data?.exists) {
      actionCreateThrowError({
        message: reportGenerateError,
      });

      log.error(`${logFileZippedPath} doesn't exist`, reportGenerateError);

      return null;
    }

    neomtp.shell.showItemInFolder(logFileZippedPath);
    await neomtp.shell.openExternal(APP_GITHUB_ISSUES_URL);
  };

  render() {
    const { classes: styles } = this.props;

    return (
      <GenerateErrorReportBody
        styles={styles}
        zippedLogFileBaseName={zippedLogFileBaseName}
        onGenerateErrorLogs={this._handleGenerateErrorLogs}
      />
    );
  }
}

const mapDispatchToProps = (dispatch, __) =>
  bindActionCreators(
    {
      actionCreateThrowError:
        ({ ...args }) =>
        (_, __) => {
          dispatch(throwAlert({ ...args }));
        },
    },
    dispatch
  );

const mapStateToProps = (_, __) => {
  return {};
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withStyles(styles)(GenerateErrorReport));
