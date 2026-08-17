import React, { PureComponent, Fragment } from 'react';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import TouchAppIcon from '@material-ui/icons/TouchApp';
import AttachFileIcon from '@material-ui/icons/AttachFile';
import SendIcon from '@material-ui/icons/Send';
import UsbIcon from '@material-ui/icons/Usb';
import Button from '@material-ui/core/Button';
import { DEVICES_LABEL } from '../../../constants';
import { DEVICE_TYPE } from '../../../enums';

export default class GenerateErrorReportBody extends PureComponent {
  render() {
    const { styles, zippedLogFileBaseName, onGenerateErrorLogs } = this.props;

    return (
      <Fragment>
        <List>
          <ListItem>
            <ListItemIcon>
              <UsbIcon />
            </ListItemIcon>
            <ListItemText
              primary={`Unlock your ${
                DEVICES_LABEL[DEVICE_TYPE.mtp]
              } and connect it to your ${
                DEVICES_LABEL[DEVICE_TYPE.local]
              } via USB`}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <FileCopyIcon />
            </ListItemIcon>
            <ListItemText primary="Turn on the 'File Transfer' mode" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <TouchAppIcon />
            </ListItemIcon>
            <ListItemText
              primary="Click the 'GENERATE ERROR LOGS' button below"
              secondary="NeoMTP will create a local report and open the issue tracker"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <AttachFileIcon />
            </ListItemIcon>
            <ListItemText
              primary="Attach the generated error log to a new issue"
              secondary={`NeoMTP will reveal ${zippedLogFileBaseName} in Finder`}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <SendIcon />
            </ListItemIcon>
            <ListItemText primary="Describe the problem and submit the issue" />
          </ListItem>
        </List>
        <Button
          variant="outlined"
          color="primary"
          className={styles.generateLogsBtn}
          onClick={onGenerateErrorLogs}
        >
          GENERATE ERROR LOGS
        </Button>
      </Fragment>
    );
  }
}
