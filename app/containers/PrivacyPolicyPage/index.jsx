import React, { Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Helmet } from 'react-helmet';
import {
  APP_GITHUB_URL,
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
            <span>Effective date: December 28, 2018</span>
          </p>
          <p>
            <span>Updated date: August 17, 2026</span>
          </p>
          <p>
            <span>
              {APP_NAME} (&quot;us&quot;, &quot;we&quot;, or &quot;our&quot;)
              operates the app (hereinafter referred to as the
              &quot;Service&quot;).
            </span>
          </p>
          <p>
            <span>
              NeoMTP contributors provide this open-source application as is.
            </span>
          </p>
          <p>
            <span>
              This page describes how {APP_NAME} handles data in the Service.
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} uses local data to provide and maintain the Service.
              The app does not collect telemetry, analytics, or usage data.
            </span>
          </p>
          <p>
            <span>
              <strong>Information Collection And Use</strong>
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} does not collect personal data, anonymous usage data,
              or telemetry. The app does not automatically send your data or
              diagnostic logs to remote services.
            </span>
          </p>
          <p>
            <span>
              <strong>Types of Data Collected</strong>
            </span>
          </p>
          <p>
            <span>Personal Data</span>
            <span>
              {APP_NAME} does not ask you to provide personally identifiable
              information that can contact or identify you (&quot;Personal
              Data&quot;).
            </span>
          </p>
          <p>
            <span>
              <u>Cookies</u>: Cookies are small data files that websites can
              store in a browser.
            </span>
          </p>
          <p>
            <span>
              This Service does not use cookies. {APP_NAME} does not use
              third-party cookies, analytics, or tracking tools to collect
              information.
            </span>
          </p>
          <p>
            <span>
              <u>Usage Data</u>: The application does not send usage analytics
              or crash reports to remote services.
            </span>
          </p>
          <p>
            <span>
              <u>LocalStorage Data</u>: The application uses local storage to
              remember your preferences and settings. These files remain on your
              device.
            </span>
          </p>
          <p>
            <span>LocalStorage files we use in the app:</span>
          </p>
          <ul>
            <li>
              <span>
                Settings File. We use Settings Files to remember your
                preferences and various settings.
              </span>
            </li>
            <li>
              <span>
                Log Files. The application stores diagnostic logs locally after
                errors occur. The application does not send these logs to remote
                services.
              </span>
            </li>
          </ul>
          <p>
            <span>
              <strong>Use of Data</strong>
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} uses local data only to provide and maintain the
              Service:
            </span>
          </p>
          <ul>
            <li>
              <span>To provide and maintain the Service</span>
            </li>
            <li>
              <span>To notify you about changes to our Service</span>
            </li>
            <li>
              <span>
                To allow you to use interactive features of our Service
              </span>
            </li>
            <li>
              <span>To provide customer care and support</span>
            </li>
            <li>
              <span>To detect, prevent and address technical issues</span>
            </li>
          </ul>
          <p>
            <span>
              <strong>Transfer Of Data</strong>
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} keeps local data on your device. The app does not
              transfer personal data, usage data, analytics, telemetry, or
              diagnostic logs to remote services.
            </span>
          </p>
          <p>
            <span>
              The app transfers files only between your computer and the
              connected Android device that you select.
            </span>
          </p>
          <p>
            <span>
              You can choose to attach diagnostic logs to a problem report on
              GitHub.
            </span>
          </p>
          <p>
            <span>
              <strong>Disclosure Of Data</strong>
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} does not receive or keep your personal data, files,
              usage data, or diagnostic logs.
            </span>
          </p>
          <p>
            <span>
              <strong>Security Of Data</strong>
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} stores local data on your device. No method of
              electronic storage is completely secure.
            </span>
          </p>
          <p>
            <span>
              <strong>Service Providers</strong>
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} does not use third-party services to collect, analyze,
              or store your usage data.
            </span>
          </p>
          <p>
            <span>
              The app does not send personal data, files, or diagnostic logs to
              third-party services.
            </span>
          </p>
          <p>
            <span>
              <strong>Links To Other Sites</strong>
            </span>
          </p>
          <p>
            <span>
              Our Service contains links to sites that we do not operate.
              Selecting a third-party link opens that site in your browser.
            </span>
          </p>
          <p>
            <span>Review the Privacy Policy of each site that you visit.</span>
          </p>
          <p>
            <span>
              We have no control over and assume no responsibility for the
              content, privacy policies, or practices of third-party sites or
              services.
            </span>
          </p>
          <p>
            <strong>
              <span>Internet Activity</span>
            </strong>
          </p>
          <p>
            <span>
              The app sends requests to GitHub.com to check for updates and to
              test the internet connection.
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
              You can disable automatic update checks. Open
              &quot;Settings&quot;, then turn off &quot;Enable auto-update
              check&quot;.
            </span>
          </p>
          <p>
            <span>
              Please refer to&nbsp;
              <a
                onClick={(events) => {
                  openExternalUrl(
                    'https://help.github.com/articles/github-privacy-statement/',
                    events
                  );
                }}
              >
                https://help.github.com/articles/github-privacy-statement/
              </a>
              &nbsp;for more information.
            </span>
          </p>
          <p>
            <span>
              <strong>Crash Reports</strong>
            </span>
          </p>
          <p>
            <span>
              The application stores diagnostic logs locally after errors occur.
            </span>
          </p>
          <p>
            <span>The application does not send these logs automatically.</span>
          </p>
          <p>
            <span>
              {`You can access the logs in "${rendererPaths.profileDir}/logs/".`}
            </span>
          </p>
          <p>
            <span>
              You can choose to send these logs with a problem report.
            </span>
          </p>
          <p>
            <span>
              Open the &quot;Help&quot; menu, then select &quot;Report
              Bugs&quot;. Select &quot;GENERATE ERROR LOGS&quot;. NeoMTP creates
              a local archive, reveals it in Finder, and opens the issue
              tracker.
            </span>
          </p>
          <p>
            <span>
              <strong>Children&#39;s Privacy</strong>
            </span>
          </p>
          <p>
            <span>
              Our Service does not address anyone under the age of 18
              (&quot;Children&quot;).
            </span>
          </p>
          <p>
            <span>
              {APP_NAME} does not knowingly collect personal data from anyone,
              including children under 18.
            </span>
          </p>
          <p>
            <span>
              <strong>Changes To This Privacy Policy</strong>
            </span>
          </p>
          <p>
            <span>
              We update this Privacy Policy from time to time. We post the new
              Privacy Policy on this page.
            </span>
          </p>
          <p>
            <span>
              Review this Privacy Policy periodically for changes. Changes to
              this Privacy Policy take effect on the date of posting.
            </span>
          </p>
          <p>
            <span>
              <strong>Contact Us</strong>
            </span>
          </p>
          <p>
            <span>
              If you have any questions about this Privacy Policy, please
              contact us:
            </span>
          </p>
          <p>
            <span>
              In the NeoMTP issue tracker:&nbsp;
              <a
                onClick={(events) => {
                  openExternalUrl(APP_GITHUB_ISSUES_URL, events);
                }}
              >
                {APP_GITHUB_ISSUES_URL}
              </a>
            </span>
          </p>
          <p>
            <span>
              By visiting this page on the website:&nbsp;
              <a
                onClick={(events) => {
                  openExternalUrl(`${APP_GITHUB_URL}`, events);
                }}
              >
                {APP_GITHUB_URL}
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
