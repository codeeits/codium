package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestHashPassword(t *testing.T) {
	pass := "password"
	hash, err := HashPassword(pass)

	if err != nil {
		t.Fatal(err)
	}

	err = CheckPasswordHash(pass, hash)
	if err != nil {
		t.Fatal(err)
	}
}

func TestHashPassword2(t *testing.T) {
	pass := "password"
	hash, err := HashPassword(pass)
	if err != nil {
		t.Fatal(err)
	}

	err = CheckPasswordHash("hehe", hash)
	if err == nil {
		t.Error("passed invalid password")
	}
}

func TestHashPassword3(t *testing.T) {
	pass := "otherpassword"
	hash, err := HashPassword("something")
	if err != nil {
		t.Fatal(err)
	}
	err = CheckPasswordHash(pass, hash)
	if err == nil {
		t.Error("passed invalid password")
	}
}

func TestMakeJWT(t *testing.T) {
	id := uuid.New()
	token, err := MakeUUIDJWT(id, "secret", time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	result, err := ValidateUUIDJWT(token, "secret")
	if err != nil {
		t.Fatal(err)
	}

	if result != id {
		t.Errorf("got %v want %v", result, id.String())
	}
}

func TestExpireJWT(t *testing.T) {
	id := uuid.New()
	token, err := MakeUUIDJWT(id, "secret", time.Second)
	if err != nil {
		t.Fatal(err)
	}

	time.Sleep(2 * time.Second)
	_, err = ValidateUUIDJWT(token, "secret")
	if err == nil {
		t.Error("expired jwt should have failed")
	}
}

func TestValidateJWT(t *testing.T) {
	id := uuid.New()
	token, err := MakeUUIDJWT(id, "secret", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ValidateUUIDJWT(token, "notthesecret")
	if err == nil {
		t.Error("invalid jwt should have failed")
	}
}

func TestGetBearerToken(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer secret")

	res, err := GetBearerToken(req.Header)
	if err != nil {
		t.Fatal(err)
	}
	if res != "secret" {
		t.Errorf("got %v want %v", res, "secret")
	}
}

func TestMakeRefreshToken(t *testing.T) {
	token, err := MakeRefreshToken()
	if err != nil {
		t.Fatal(err)
	}

	println(token)
}

func TestMakeGeneralJWT(t *testing.T) {
	token, err := MakeGeneralJWT([]byte("payload"), "secret")
	if err != nil {
		t.Fatal(err)
	}

	res, err := ValidateGeneralJWT(token, "secret")
	if err != nil {
		t.Fatal(err)
	}

	if string(res) != "payload" {
		t.Errorf("got %v want %v", string(res), "payload")
	}
}
