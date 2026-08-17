package send_to_js

import (
	"errors"
	"testing"
)

func TestSendErrorWithNilCallback(t *testing.T) {
	SendError(nil, errors.New("callback is optional"))
}
