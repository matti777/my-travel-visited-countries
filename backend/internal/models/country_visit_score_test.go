package models

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestValidateScore(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		score   int
		wantErr bool
	}{
		{name: "min", score: MinScore, wantErr: false},
		{name: "default", score: DefaultScore, wantErr: false},
		{name: "max", score: MaxScore, wantErr: false},
		{name: "mid", score: 75, wantErr: false},
		{name: "zero", score: 0, wantErr: true},
		{name: "below min", score: MinScore - 1, wantErr: true},
		{name: "above max", score: MaxScore + 1, wantErr: true},
		{name: "negative", score: -1, wantErr: true},
		{name: "large", score: 1000, wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateScore(tt.score)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ValidateScore(%d) = nil, want error", tt.score)
				}
				if !strings.Contains(err.Error(), "score must be between") {
					t.Fatalf(
						"ValidateScore(%d) error %q, want message about bounds",
						tt.score,
						err.Error(),
					)
				}
				return
			}
			if err != nil {
				t.Fatalf("ValidateScore(%d) = %v, want nil", tt.score, err)
			}
		})
	}
}

func TestApplyScoreDefault(t *testing.T) {
	t.Parallel()

	t.Run("nil visit is no-op", func(t *testing.T) {
		t.Parallel()
		ApplyScoreDefault(nil)
	})

	t.Run("zero becomes default", func(t *testing.T) {
		t.Parallel()
		visit := &CountryVisit{Score: 0}
		ApplyScoreDefault(visit)
		if visit.Score != DefaultScore {
			t.Fatalf("Score = %d, want %d", visit.Score, DefaultScore)
		}
	})

	t.Run("preserves valid scores", func(t *testing.T) {
		t.Parallel()
		for _, score := range []int{MinScore, DefaultScore, MaxScore, 33} {
			visit := &CountryVisit{Score: score}
			ApplyScoreDefault(visit)
			if visit.Score != score {
				t.Fatalf("Score = %d, want %d", visit.Score, score)
			}
		}
	})

	t.Run("does not rewrite out-of-range non-zero", func(t *testing.T) {
		t.Parallel()
		// Only unset (0) is defaulted; corrupt non-zero values stay as stored.
		visit := &CountryVisit{Score: 101}
		ApplyScoreDefault(visit)
		if visit.Score != 101 {
			t.Fatalf("Score = %d, want 101", visit.Score)
		}
	})
}

func TestScoreConstants(t *testing.T) {
	t.Parallel()
	if MinScore != 1 {
		t.Fatalf("MinScore = %d, want 1", MinScore)
	}
	if MaxScore != 100 {
		t.Fatalf("MaxScore = %d, want 100", MaxScore)
	}
	if DefaultScore != 50 {
		t.Fatalf("DefaultScore = %d, want 50", DefaultScore)
	}
}

func TestApplyScoreDefault_JSONAlwaysIncludesScore(t *testing.T) {
	t.Parallel()
	visit := CountryVisit{CountryCode: "AF", Score: 0}
	ApplyScoreDefault(&visit)
	b, err := json.Marshal(visit)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	score, ok := m["score"].(float64)
	if !ok {
		t.Fatalf("score missing or wrong type in %s", b)
	}
	if int(score) != DefaultScore {
		t.Fatalf("score = %v, want %d", score, DefaultScore)
	}
}
