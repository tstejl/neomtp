import { APP_GITHUB_ISSUES_URL } from '../constants/meta';

export const loadProfileErrorHtml = `
        <html lang="en-gb">
          <body>
              <h3>Unable to load profile files. Please restart the app. </h3>
              <p>Open an issue if the problem persists.</p>
              <a href="${APP_GITHUB_ISSUES_URL}">${APP_GITHUB_ISSUES_URL}</a>
          </body>
        </html>
      `;
