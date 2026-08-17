import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Helmet } from 'react-helmet';
import {
  APP_GITHUB_ISSUES_URL,
  APP_NAME,
  APP_TITLE,
} from '../../constants/meta';
import { openExternalUrl } from '../../utils/url';
import { resetOverFlowY } from '../../utils/styleResets';
import { PRIVACY_POLICY_PAGE_TITLE } from '../../templates/privacyPolicyPage';
import { styles } from './styles';
import { rendererPaths } from '../../helpers/rendererPaths';

class PrivacyPolicyPage extends Component {
  componentWillMount() {
    resetOverFlowY();
  }

  render() {
    const { classes: styles } = this.props;

    return (
      <div className={styles.root}>
        <Helmet titleTemplate={`%s - ${APP_TITLE}`}>
          <title>{PRIVACY_POLICY_PAGE_TITLE}</title>
        </Helmet>
        <Typography variant="h5" className={styles.heading}>
          Privacy policy for {APP_NAME}
        </Typography>
        <div className={styles.body}>
          <p>
            <span>Updated: August 17, 2026</span>
          </p>

          <p>
            <span>
              {APP_NAME} processes files and device information locally.
            </span>
          </p>

          <p>
            <strong>Data collection</strong>
          </p>
          <p>
            <span>
              {APP_NAME} does not collect telemetry, analytics, usage data, or
              crash reports.
            </span>
          </p>
          <p>
            <span>
              The app does not automatically upload files, settings, or
              diagnostic logs.
            </span>
          </p>

          <p>
            <strong>Local data</strong>
          </p>
          <p>
            <span>
              The app stores settings and diagnostic logs in the local NeoMTP
              profile.
            </span>
          </p>
          <p>
            <span>
              {`Diagnostic logs are in "${rendererPaths.profileDir}/logs/".`}
            </span>
          </p>
          <p>
            <span>
              File transfers occur only between your Mac and the MTP device that
              you select.
            </span>
          </p>

          <p>
            <strong>Network requests</strong>
          </p>
          <p>
            <span>
              The app can contact GitHub to check for updates and internet
              connectivity.
            </span>
          </p>
          <p>
            <span>
              These requests do not include your files, usage data, or
              diagnostic logs.
            </span>
          </p>
          <p>
            <span>
              The application settings include an option to disable automatic
              update checks.
            </span>
          </p>

          <p>
            <strong>Optional reports</strong>
          </p>
          <p>
            <span>
              {APP_NAME} can create a local diagnostic archive and reveal it in
              Finder.
            </span>
          </p>
          <p>
            <span>The app does not upload this archive.</span>
          </p>
          <p>
            <span>
              If you attach the archive to an issue, GitHub processes the
              submitted data under its policies.
            </span>
          </p>

          <p>
            <strong>Contact</strong>
          </p>
          <p>
            <span>
              Report privacy problems in the NeoMTP issue tracker:&nbsp;
              <a
                onClick={(events) => {
                  openExternalUrl(APP_GITHUB_ISSUES_URL, events);
                }}
              >
                {APP_GITHUB_ISSUES_URL}
              </a>
            </span>
          </p>
        </div>
      </div>
    );
  }
}

const mapDispatchToProps = (dispatch, __) => bindActionCreators({}, dispatch);

const mapStateToProps = (_, __) => {
  return {};
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withStyles(styles)(PrivacyPolicyPage));
