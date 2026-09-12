package auth

import (
	"errors"
	"strings"
	"testing"
)

func TestHashAndCheckPassword(t *testing.T) {
	const pw = "correct horse battery staple"

	hash, err := hashPassword(pw)
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}
	if hash == pw {
		t.Fatal("password stored in plaintext")
	}
	if !checkPassword(hash, pw) {
		t.Fatal("checkPassword rejected the correct password")
	}
	if checkPassword(hash, "wrong password") {
		t.Fatal("checkPassword accepted a wrong password")
	}
}

func TestRegisterRejectsPasswordLongerThanBcryptLimit(t *testing.T) {
	s := testService()
	_, _, err := s.Register(t.Context(), "user@example.com", strings.Repeat("a", maxPasswordBytes+1))
	if !errors.Is(err, ErrPasswordTooLong) {
		t.Fatalf("Register error: want %v, got %v", ErrPasswordTooLong, err)
	}
}

func TestValidatePasswordCountsCharactersNotUTF8Bytes(t *testing.T) {
	if err := validatePassword("абвг"); !errors.Is(err, ErrWeakPassword) {
		t.Fatalf("validatePassword(4 Cyrillic characters) = %v, want %v", err, ErrWeakPassword)
	}
	if err := validatePassword("абвгдежз"); err != nil {
		t.Fatalf("validatePassword(8 Cyrillic characters) = %v, want nil", err)
	}
}

func TestNormalizeNicknameAcceptsCyrillicAndRejectsUnsafeCharacters(t *testing.T) {
	for _, nickname := range []string{"madtrip", "Алго_кот", "dev-42"} {
		got, err := normalizeNickname(nickname)
		if err != nil || got != nickname {
			t.Fatalf("normalizeNickname(%q) = %q, %v", nickname, got, err)
		}
	}

	for _, nickname := range []string{"ab", "hello world", "<script>", strings.Repeat("a", maxNicknameRunes+1)} {
		if _, err := normalizeNickname(nickname); !errors.Is(err, ErrInvalidNickname) {
			t.Fatalf("normalizeNickname(%q) error = %v, want %v", nickname, err, ErrInvalidNickname)
		}
	}
}
