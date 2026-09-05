package observability

import (
	"testing"

	"github.com/getsentry/sentry-go"
)

func TestTraceSampleRate(t *testing.T) {
	production := traceSampleRate("production")
	if got := production(sentry.SamplingContext{Span: &sentry.Span{Name: "GET /api/v1/me"}}); got != 0.1 {
		t.Fatalf("production sample rate = %v, want 0.1", got)
	}
	if got := production(sentry.SamplingContext{Span: &sentry.Span{Name: "GET /healthz"}}); got != 0 {
		t.Fatalf("health sample rate = %v, want 0", got)
	}
	if got := production(sentry.SamplingContext{Span: &sentry.Span{Name: "GET /api/v1/me"}, ParentSampled: sentry.SampledTrue}); got != 1 {
		t.Fatalf("continued trace sample rate = %v, want 1", got)
	}
	if got := traceSampleRate("staging")(sentry.SamplingContext{Span: &sentry.Span{Name: "GET /api/v1/me"}}); got != 1 {
		t.Fatalf("staging sample rate = %v, want 1", got)
	}
}
