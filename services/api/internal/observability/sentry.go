package observability

import (
	"os"
	"strings"

	"github.com/getsentry/sentry-go"
)

// InitSentry enables reporting only in deployed environments. An empty DSN
// leaves the SDK disabled, so observability can never prevent the API starting.
func InitSentry() error {
	environment := os.Getenv("SENTRY_ENVIRONMENT")
	if os.Getenv("SENTRY_DSN") == "" || (environment != "staging" && environment != "production") {
		return nil
	}

	off := &sentry.KeyValueCollectionBehavior{Mode: sentry.CollectionOff}
	return sentry.Init(sentry.ClientOptions{
		Dsn:              os.Getenv("SENTRY_DSN"),
		Environment:      environment,
		Release:          os.Getenv("SENTRY_RELEASE"),
		AttachStacktrace: true,
		EnableTracing:    true,
		TracesSampler:    traceSampleRate(environment),
		DataCollection: &sentry.DataCollection{
			UserInfo:    sentry.Set(false),
			Cookies:     off,
			HTTPBodies:  []sentry.BodyType{},
			QueryParams: off,
			HTTPHeaders: &sentry.HeaderCollectionConfig{Request: off, Response: off},
		},
		BeforeSend: func(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
			if event.User.ID != "" {
				event.User = sentry.User{ID: event.User.ID}
			} else {
				event.User = sentry.User{}
			}
			return event
		},
	})
}

func traceSampleRate(environment string) sentry.TracesSampler {
	rate := 1.0
	if environment == "production" {
		rate = 0.1
	}

	return func(ctx sentry.SamplingContext) float64 {
		if strings.HasSuffix(ctx.Span.Name, "/healthz") || strings.HasSuffix(ctx.Span.Name, "/readyz") {
			return 0
		}
		if ctx.ParentSampled == sentry.SampledTrue {
			return 1
		}
		if ctx.ParentSampled == sentry.SampledFalse {
			return 0
		}
		return rate
	}
}
