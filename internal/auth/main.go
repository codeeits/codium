package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	res, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(res), nil
}

func CheckPasswordHash(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func MakeJWT(userID uuid.UUID, tokenSecret string, expiresIn time.Duration) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Issuer:    "Codium",
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiresIn)),
		Subject:   userID.String(),
	})
	res, err := token.SignedString([]byte(tokenSecret))
	if err != nil {
		return "", err
	}
	return res, nil
}

func ValidateJWT(tokenString, tokenSecret string) (uuid.UUID, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(tokenSecret), nil
	})
	if err != nil {
		return uuid.Nil, err
	}
	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok {
		return uuid.Nil, errors.New("invalid token")
	}
	subject, err := claims.GetSubject()
	if err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(subject)
}

func GetBearerToken(headers http.Header) (string, error) {
	bearerToken := headers.Get("Authorization")
	if len(bearerToken) == 0 {
		return "", errors.New("missing authorization token")
	}

	return strings.TrimPrefix(bearerToken, "Bearer "), nil
}

func MakeRefreshToken() (string, error) {
	refresh := make([]byte, 32)
	_, err := rand.Read(refresh)
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(refresh), nil
}

func GetAPIKey(headers http.Header) (string, error) {
	auth := headers.Get("Authorization")
	if len(auth) == 0 {
		return "", errors.New("missing authorization token")
	}

	return strings.TrimPrefix(auth, "ApiKey "), nil
}
