package main

import (
	"sync"
	"testing"
)

func TestMtpLockNonBlockingAndLifecycle(t *testing.T) {
	originalMtpLock := mtpLock
	mtpLock = make(chan struct{}, 1)
	t.Cleanup(func() {
		mtpLock = originalMtpLock
	})

	if err := lockMtp(); err != nil {
		t.Fatalf("first lockMtp() failed: %v", err)
	}

	if err := lockMtp(); err == nil || err.Error() != "ErrorMtpLockExists" {
		t.Fatalf("second lockMtp() error = %v, want ErrorMtpLockExists", err)
	}

	unlockMtp()

	if err := lockMtp(); err != nil {
		t.Fatalf("lockMtp() did not become available after unlockMtp(): %v", err)
	}
	unlockMtp()

	const contenders = 32
	var wg sync.WaitGroup
	holderReady := make(chan struct{})
	releaseHolder := make(chan struct{})
	holderDone := make(chan struct{})
	go func() {
		if err := lockMtp(); err != nil {
			t.Errorf("holder lockMtp() failed: %v", err)
			close(holderReady)
			close(holderDone)
			return
		}
		close(holderReady)
		<-releaseHolder
		unlockMtp()
		close(holderDone)
	}()
	<-holderReady

	start := make(chan struct{})
	results := make(chan error, contenders)

	for i := 0; i < contenders; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			if err := lockMtp(); err != nil {
				results <- err
				return
			}
			results <- nil
			unlockMtp()
		}()
	}

	close(start)
	wg.Wait()
	close(results)

	var successful, lockErrors int
	for err := range results {
		if err == nil {
			successful++
			continue
		}
		if err.Error() != "ErrorMtpLockExists" {
			t.Fatalf("unexpected lock error: %v", err)
		}
		lockErrors++
	}

	if successful != 0 {
		t.Fatalf("successful lock attempts while holder was active = %d, want 0", successful)
	}
	if lockErrors != contenders {
		t.Fatalf("lock errors while holder was active = %d, want %d", lockErrors, contenders)
	}

	close(releaseHolder)
	<-holderDone
	if err := lockMtp(); err != nil {
		t.Fatalf("lockMtp() did not become available after concurrent holder released: %v", err)
	}
	unlockMtp()
}
