import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { Helmet } from 'react-helmet';
import { styles } from './styles';
import releaseNotesStyles from './styles/release-notes.module.scss';
import { undefinedOrNull } from '../../../utils/funcs';
import { APP_NAME, APP_VERSION } from '../../../constants/meta';
import { setStyle } from '../../../utils/styles';
import { getAppThemeMode } from '../../../helpers/theme';
import { getCurrentThemePalette } from '../../App/styles';
import { getOpenMtpApi } from '../../../helpers/electronApi';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';

class AppUpdatePage extends Component {
  constructor(props) {
    super(props);

    this.state = {
      releaseInfo: {},
    };
  }

  componentWillMount() {
    getOpenMtpApi().ipc.on(
      'appUpdatesUpdateAvailableCommunication',
      this.updateAvailableCommunicationEvent
    );
  }

  componentDidMount() {
    const appThemeMode = getAppThemeMode(
      getOpenMtpApi().settings.getItems(['appThemeMode']).appThemeMode
    );
    const { nativeSystemColor } = getCurrentThemePalette(appThemeMode);

    setStyle(document.body, {
      background: `${nativeSystemColor} !important`,
    });
  }

  componentWillUnmount() {
    getOpenMtpApi().ipc.removeListener(
      'appUpdatesUpdateAvailableCommunication',
      this.updateAvailableCommunicationEvent
    );
  }

  updateAvailableCommunicationEvent = (_, args) => {
    this.setState({ releaseInfo: { ...args } });
  };

  _handleBtnClick = ({ confirm }) => {
    getOpenMtpApi().ipc.send('appUpdatesUpdateAvailableReply', { confirm });
    window.close();
  };

  render() {
    const { classes: styles } = this.props;
    const { releaseInfo } = this.state;

    if (undefinedOrNull(releaseInfo) || Object.keys(releaseInfo).length < 1) {
      return (
        <div>
          <Helmet titleTemplate="%s">
            <title>Software Update</title>
          </Helmet>
          <Typography variant="subtitle1" className={styles.loadingText}>
            Fetching Update Information...
          </Typography>
        </div>
      );
    }

    const { releaseName, releaseNotes } = releaseInfo;
    const sanitizedReleaseNotesHtml = sanitizeHtml(releaseNotes);

    return (
      <div className={styles.root}>
        <Helmet titleTemplate="%s">
          <title>Software Update</title>
        </Helmet>
        <Typography variant="subtitle1" className={styles.title}>
          A new version of {APP_NAME} is available!
        </Typography>
        <Typography variant="caption">
          {releaseName} is now available &ndash; you have {APP_VERSION}. Would
          you like to download it now?
        </Typography>

        <Typography variant="body2" className={styles.releaseNotes}>
          Release Notes:
        </Typography>

        <div className={styles.scrollContainer}>
          {/* eslint-disable react/no-danger */}
          <div
            className={`${releaseNotesStyles.releaseNotes}`}
            dangerouslySetInnerHTML={{
              __html: sanitizedReleaseNotesHtml,
            }}
          />
          {/* eslint-enable react/no-danger */}
        </div>

        <div className={styles.btnWrapper}>
          <Button
            onClick={() => this._handleBtnClick({ confirm: false })}
            color="secondary"
            className={styles.btnNegative}
          >
            No
          </Button>
          <Button
            onClick={() => this._handleBtnClick({ confirm: true })}
            color="primary"
            className={styles.btnPositive}
          >
            Yes
          </Button>
        </div>
      </div>
    );
  }
}

export default withStyles(styles)(AppUpdatePage);
