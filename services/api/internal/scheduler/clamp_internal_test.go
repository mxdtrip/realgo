package scheduler

import (
	"testing"
	"time"
)

// TestClampReviewTime фиксирует контракт W1: клиентская метка reviewedAt
// клампится в одном месте — внутри scheduler. Будущее (свыше ε-допуска на
// clock skew) → now; прошлое раньше lastReview → lastReview (честный
// «немедленный повтор», elapsed=0, а не отказ и не отрицательный elapsed);
// валидная прошлая метка (оффлайн-очередь extension) не трогается.
func TestClampReviewTime(t *testing.T) {
	base := time.Date(2026, 8, 19, 12, 0, 0, 0, time.UTC)

	cases := []struct {
		name             string
		reviewedAtOffset time.Duration // смещение от base
		lastReviewOffset time.Duration // смещение от base; lastReviewAbsent=true — истории нет (zero time)
		lastReviewAbsent bool
		wantOffset       time.Duration // ожидаемое смещение результата от base
	}{
		{name: "будущее далеко — clamp к now", reviewedAtOffset: 24 * time.Hour, lastReviewOffset: -24 * time.Hour, wantOffset: 0},
		{name: "будущее в пределах clock skew — без изменений", reviewedAtOffset: 30 * time.Second, lastReviewOffset: -24 * time.Hour, wantOffset: 30 * time.Second},
		{name: "прошлое раньше lastReview — clamp к lastReview", reviewedAtOffset: -48 * time.Hour, lastReviewOffset: -24 * time.Hour, wantOffset: -24 * time.Hour},
		{name: "валидное прошлое позже lastReview — без изменений", reviewedAtOffset: -12 * time.Hour, lastReviewOffset: -24 * time.Hour, wantOffset: -12 * time.Hour},
		{name: "без истории (новая карточка) — без изменений", reviewedAtOffset: -12 * time.Hour, lastReviewAbsent: true, wantOffset: -12 * time.Hour},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			reviewedAt := base.Add(tc.reviewedAtOffset)
			lastReview := time.Time{}
			if !tc.lastReviewAbsent {
				lastReview = base.Add(tc.lastReviewOffset)
			}
			want := base.Add(tc.wantOffset)
			got := clampReviewTime(reviewedAt, lastReview, base)
			if !got.Equal(want) {
				t.Errorf("clampReviewTime(%v, %v, now=%v) = %v, want %v",
					reviewedAt, lastReview, base, got, want)
			}
		})
	}
}
