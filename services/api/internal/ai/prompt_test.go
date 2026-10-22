package ai

import (
	"strings"
	"testing"
)

func TestSplitPromptWindowsLineEndings(t *testing.T) {
	const doc = "Intro\n<!-- system -->\nSystem text\n<!-- user -->\nUser text\n"
	for _, input := range []string{doc, strings.ReplaceAll(doc, "\n", "\r\n")} {
		system, user, err := splitPrompt(input)
		if err != nil {
			t.Fatal(err)
		}
		if system != "System text" || user != "User text" {
			t.Fatalf("unexpected sections: system=%q user=%q", system, user)
		}
	}
}
