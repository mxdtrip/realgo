package admin

import (
	"errors"
	"testing"

	"github.com/lib/pq"
)

func TestProblemFormError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "problem platform slug conflict",
			err:  &pq.Error{Code: "23505", Constraint: "problems_platform_id_external_slug_key"},
			want: duplicateProblemSlugError,
		},
		{
			name: "another unique constraint",
			err:  &pq.Error{Code: "23505", Constraint: "users_email_key"},
			want: "pq: ",
		},
		{name: "ordinary error", err: errors.New("database unavailable"), want: "database unavailable"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := problemFormError(tt.err)
			if got == nil || got.Error() != tt.want {
				t.Fatalf("problemFormError() = %v, want %q", got, tt.want)
			}
		})
	}
}
