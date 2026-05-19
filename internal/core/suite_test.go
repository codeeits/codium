package core

//This file is going to contain tests for the entire application stack, divided into sections for each major component.

import (
	"Codium/internal/database"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"reflect"
	"strconv"
	"testing"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

/*
	===========================================

		Helpers and Structs

	===========================================
*/

type RequestBuilder struct {
	queryParams      string
	baseUrl          string
	method           string
	bytesBody        []byte
	wantedStatus     int
	targetStructType interface{}
	token            string
	refreshToken     string
	contentType      string
}

// Build builds and executes the HTTP request, returning the response decoded into the target struct type.
func (u *RequestBuilder) Build() (interface{}, []*http.Cookie, error) {
	ctx := context.Background()
	req, err := http.NewRequestWithContext(ctx, u.method, u.baseUrl+u.queryParams, bytes.NewReader(u.bytesBody))
	if err != nil {
		return u.targetStructType, nil, err
	}
	req.Header.Set("Content-Type", u.contentType)
	if u.token != "" {
		req.AddCookie(&http.Cookie{
			Name:  "session_token",
			Value: u.token,
		})
	}
	if u.refreshToken != "" {
		req.AddCookie(&http.Cookie{
			Name:  "refresh_token",
			Value: u.refreshToken,
		})
	}

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return u.targetStructType, nil, err
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {
			fmt.Println("Error closing response body:", err)
		}
	}(res.Body)

	if res.StatusCode != u.wantedStatus {
		return u.targetStructType, nil, fmt.Errorf("wrong status code: %d", res.StatusCode)
	}

	returnedCookies := res.Cookies()

	// Decode response into target struct type
	if err := json.NewDecoder(res.Body).Decode(u.targetStructType); err != nil {
		return u.targetStructType, nil, err
	}

	// If targetStructType is a pointer, return the dereferenced concrete value so callers can assert to T
	rv := reflect.ValueOf(u.targetStructType)
	if rv.Kind() == reflect.Ptr {
		return rv.Elem().Interface(), returnedCookies, nil
	}
	return u.targetStructType, returnedCookies, nil
}

// BuildRaw builds and executes the HTTP request, returning the raw http.Response.
func (u *RequestBuilder) BuildRaw() (*http.Response, []*http.Cookie, error) {
	ctx := context.Background()
	req, err := http.NewRequestWithContext(ctx, u.method, u.baseUrl+u.queryParams, bytes.NewReader(u.bytesBody))
	if err != nil {
		return nil, nil, err
	}
	if u.token != "" {
		req.AddCookie(&http.Cookie{
			Name:  "session_token",
			Value: u.token,
		})
	}
	if u.refreshToken != "" {
		req.AddCookie(&http.Cookie{
			Name:  "refresh_token",
			Value: u.refreshToken,
		})
	}

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, nil, err
	}

	if res.StatusCode != u.wantedStatus {
		return nil, nil, fmt.Errorf("wrong status code: %d", res.StatusCode)
	}

	returnedCookies := res.Cookies()
	return res, returnedCookies, nil
}

func (u *RequestBuilder) WithPath(path string) *RequestBuilder {
	u.baseUrl += path
	return u
}

func (u *RequestBuilder) WithQueryParam(key, value string) *RequestBuilder {
	if u.queryParams == "" {
		u.queryParams += "?"
	} else {
		u.queryParams += "&"
	}
	u.queryParams += key + "=" + value
	return u
}

func (u *RequestBuilder) WithAuthToken(token string) *RequestBuilder {
	u.token = token
	return u
}

func (u *RequestBuilder) WithContentType(contentType string) *RequestBuilder {
	u.contentType = contentType
	return u
}

// WithGeneratedFile adds a generated file to the request body as multipart/form-data.
func (u *RequestBuilder) WithGeneratedFile(fileData []byte, fieldName, fileName string) *RequestBuilder {
	var requestFileData bytes.Buffer
	writer := multipart.NewWriter(&requestFileData)
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		return u
	}
	_, err = part.Write(fileData)
	if err != nil {
		return u
	}
	err = writer.Close()
	if err != nil {
		return u
	}
	u.bytesBody = requestFileData.Bytes()
	u.contentType = writer.FormDataContentType()
	return u
}

func (u *RequestBuilder) WithRefreshToken(refreshToken string) *RequestBuilder {
	u.refreshToken = refreshToken
	return u
}

// For the sake of testing we'll assume we're using localhost:6767 as base URL
func NewRequestBuilder[T any](method string, jsonBody []byte, wantedStatus int, _ T) *RequestBuilder {
	return &RequestBuilder{
		baseUrl:          "http://localhost:6767",
		queryParams:      "",
		method:           method,
		bytesBody:        jsonBody,
		wantedStatus:     wantedStatus,
		contentType:      "application/json",
		targetStructType: new(T),
	}
}

func NewRequestBuilderNoTarget(method string, jsonBody []byte, wantedStatus int) *RequestBuilder {
	return &RequestBuilder{
		baseUrl:      "http://localhost:6767",
		queryParams:  "",
		method:       method,
		bytesBody:    jsonBody,
		wantedStatus: wantedStatus,
	}
}

func assertNonNilID(t *testing.T, id uuid.UUID, context string) {
	t.Helper()
	if id == uuid.Nil {
		t.Fatalf("Expected non-nil ID for %s", context)
	}
}

/*
	===========================================

		Main entry point for tests

	===========================================
*/

func TestSuiteStart(t *testing.T) {
	cfg := &ApiCfg{}
	cfg.TestSuite(t)
}

func (cfg *ApiCfg) TestSuite(t *testing.T) {
	t.Run(".envTests", func(t *testing.T) {
		// Call .env-related test functions here
		err := godotenv.Load("../../.env")
		if err != nil {
			t.Fatal("Error loading .env file")
		}

		cfg.DatabaseCfg.Url = os.Getenv("DB_URL")
		cfg.Secret = os.Getenv("SECRET")
		cfg.AdminCfg.Password = os.Getenv("ADMIN_DEFAULT_PASSWORD")
		cfg.SmtpCfg.Url = os.Getenv("SMTP_URL")
		cfg.SmtpCfg.Port = 587 // Default SMTP port
		cfg.SmtpCfg.User = os.Getenv("SMTP_USER")
		cfg.SmtpCfg.Password = os.Getenv("SMTP_PASSWORD")
		cfg.WebsiteUrl = os.Getenv("WEBSITE_URL")
		cfg.WebsiteState = os.Getenv("WEBSITE_STATE")

		if cfg.WebsiteState == "" {
			//website state is MANDATORY; it determines whether the website resets at the end of testing suite
			t.Fatal("No website state provided")
		}
		if cfg.Secret == "" {
			t.Log("No secret provided")
			t.Fail()
		}
		if cfg.DatabaseCfg.Url == "" {
			t.Log("No db url provided")
			t.Fail()
		}
		if cfg.AdminCfg.Password == "" {
			t.Log("No admin default password provided")
			t.Fail()
		}
		if cfg.SmtpCfg.Url == "" {
			t.Log("No SMTP url provided")
			t.Fail()
		}
		if cfg.SmtpCfg.User == "" {
			t.Log("No SMTP user provided")
			t.Fail()
		}
		if cfg.SmtpCfg.Password == "" {
			t.Log("No SMTP password provided")
			t.Fail()
		}
		if cfg.WebsiteUrl == "" {
			t.Log("No website url provided")
			t.Fail()
		}
	})

	t.Run("DatabaseTests", func(t *testing.T) {
		db, err := sql.Open("postgres", cfg.DatabaseCfg.Url)
		if err != nil {
			t.Fatal("Error connecting to the database: ", err)
		}

		err = db.Ping()
		if err != nil {
			t.Fatal("Error pinging database: ", err)
		}

		cfg.Db = database.New(db)
		cfg.DatabaseCfg.Loaded = true
		t.Log("Successfully connected to the database!")
	})

	var adminToken string
	var adminRefreshToken string
	var adminID uuid.UUID
	t.Run("ApiTests", func(t *testing.T) {
		// Call API-related test functions here
		if !cfg.DatabaseCfg.Loaded {
			return
		}

		client := &http.Client{}

		/*
			===========================================

				File Serving Tests

			===========================================
		*/
		t.Run("TestStaticFileServing", func(t *testing.T) {
			req, err := http.NewRequest("GET", "http://localhost:6767/app/", nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer func(Body io.ReadCloser) {
				err := Body.Close()
				if err != nil {
					fmt.Println("Error closing response body:", err)
				}
			}(resp.Body)

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}
		})

		/*
			===========================================

				User Management Tests

			===========================================
		*/
		t.Run("TestGetDefaultAdminUser", func(t *testing.T) {
			jsonBody := []byte(`{"email":"codiumOfficial@lekas.tech","password":"` + cfg.AdminCfg.Password + `"}`)

			resp, cookies, err := NewRequestBuilder("POST", jsonBody, http.StatusOK, database.User{}).WithPath("/api/login").Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var translated = resp.(database.User)

			if len(cookies) < 2 {
				t.Fatal("Expected to get at least session and refresh tokens, got: ", len(cookies))
			}

			if !UserHasPermission(translated, PermissionAdmin) {
				t.Fatalf("Expected user to have admin permissions, got %v", translated.Permissions)
			}

			for _, cookie := range cookies {
				if cookie.Name == "session_token" {
					adminToken = cookie.Value
				}
				if cookie.Name == "refresh_token" {
					adminRefreshToken = cookie.Value
				}
			}
			adminID = translated.ID

			assertNonNilID(t, translated.ID, "default admin login response")
		})

		var averageUserEmail = "testing@nthing.com"
		var averageUserPassword = "TestPassword123!"
		var averageUserID uuid.UUID
		t.Run("TestCreateUser", func(t *testing.T) {
			var averageUserUsername = "TestUser"
			jsonBody := []byte(`{"email":"` + averageUserEmail + `","password":"` + averageUserPassword + `","username":"` + averageUserUsername + `"}`)
			resp, _, err := NewRequestBuilder("POST", jsonBody, http.StatusCreated, database.User{}).WithPath("/api/users").Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var user database.User
			if user = resp.(database.User); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if user.Email != averageUserEmail {
				t.Fatalf("Expected email %s, got %s", averageUserEmail, user.Email)
			}
			if user.Username != averageUserUsername {
				t.Fatalf("Expected username %s, got %s", averageUserUsername, user.Username)
			}
			if UserHasPermission(user, PermissionAdmin) {
				t.Fatalf("Expected user to not have admin permissions, got %v", user.Permissions)
			}

			assertNonNilID(t, user.ID, "created user")
		})

		var averageUserToken string
		t.Run("TestLoginUser", func(t *testing.T) {
			jsonBody := []byte(`{"email":"` + averageUserEmail + `","password":"` + averageUserPassword + `"}`)

			resp, cookies, err := NewRequestBuilder("POST", jsonBody, http.StatusOK, database.User{}).WithPath("/api/login").Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var translated = resp.(database.User)

			if len(cookies) < 2 {
				t.Fatal("Expected to get at least session and refresh tokens, got: ", len(cookies))
			}

			if translated.Email != averageUserEmail {
				t.Fatalf("Expected email %s, got %s", averageUserEmail, translated.Email)
			}

			for _, cookie := range cookies {
				if cookie.Name == "session_token" {
					averageUserToken = cookie.Value
				}
			}

			averageUserID = translated.ID

			assertNonNilID(t, translated.ID, "average user login response")
		})

		t.Run("TestUnauthorizedReset", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("POST", nil, http.StatusUnauthorized).WithPath("/admin/reset").BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestUpdatingProfileBeforeTokenRefresh", func(t *testing.T) {
			jsonBody := []byte(`{"username":"UpdatedAdminUser"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonBody, http.StatusOK, database.User{}).WithPath("/api/users").WithQueryParam("target_field", "username").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var user database.User
			if user = resp.(database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if user.Username != "UpdatedAdminUser" {
				t.Fatalf("Expected username %s, got %s", "UpdatedAdminUser", user.Username)
			}

			assertNonNilID(t, user.ID, "updated admin profile before refresh")
		})

		t.Run("TestRefreshToken", func(t *testing.T) {
			_, cookies, err := NewRequestBuilder("POST", nil, http.StatusOK, database.User{}).WithPath("/api/refresh").WithRefreshToken(adminRefreshToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			if len(cookies) == 0 {
				t.Fatal("Expected to get at least one cookie, got: ", len(cookies))
			}
			for _, cookie := range cookies {
				if cookie.Name == "session_token" {
					adminToken = cookie.Value
				}
			}
		})

		t.Run("TestUpdatingProfileAfterTokenRefresh", func(t *testing.T) {
			jsonBody := []byte(`{"username":"RefreshedAdminUser"}`)

			resp, _, err := NewRequestBuilder("PUT", jsonBody, http.StatusOK, database.User{}).WithPath("/api/users").WithQueryParam("target_field", "username").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var user database.User
			if user = resp.(database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if user.Username != "RefreshedAdminUser" {
				t.Fatalf("Expected username %s, got %s", "RefreshedAdminUser", user.Username)
			}

			assertNonNilID(t, user.ID, "updated admin profile after refresh")
		})

		t.Run("TestGetUsers", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, []database.User{}).WithPath("/api/users").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var users []database.User
			if users = resp.([]database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if len(users) < 2 {
				t.Fatalf("Expected at least %d users, got %d", 2, len(users))
			}

			for _, user := range users {
				if user.PasswordHash != "" {
					t.Fatalf("Expected password hash to be omitted, got %s", user.PasswordHash)
				}

				assertNonNilID(t, user.ID, "user in users list")
			}
		})

		var secondAverageUserID uuid.UUID
		var secondAverageUserEmail = "second@hello.world"
		var secondAverageToken string
		t.Run("TestCreateSecondAverageUser", func(t *testing.T) {
			var secondAverageUsername = "SecondAverageUser"
			var secondAveragePassword = "AnotherPassword123!"
			jsonBody := []byte(`{"email":"` + secondAverageUserEmail + `","password":"` + secondAveragePassword + `","username":"` + secondAverageUsername + `"}`)
			resp, _, err := NewRequestBuilder("POST", jsonBody, http.StatusCreated, database.User{}).WithPath("/api/users").Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var user database.User
			if user = resp.(database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if user.Email != secondAverageUserEmail {
				t.Fatalf("Expected email %s, got %s", secondAverageUserEmail, user.Email)
			}
			secondAverageUserID = user.ID

			// Now log in the second average user to get their token
			loginBody := []byte(`{"email":"` + secondAverageUserEmail + `","password":"` + secondAveragePassword + `"}`)

			loginResp, cookies, err := NewRequestBuilder("POST", loginBody, http.StatusOK, database.User{}).WithPath("/api/login").Build()
			if err != nil {
				t.Fatal("Error logging in second average user: ", err)
			}
			var translated = loginResp.(database.User)

			if len(cookies) < 2 {
				t.Fatal("Expected to get at least session and refresh tokens, got: ", len(cookies))
			}

			for _, cookie := range cookies {
				if cookie.Name == "session_token" {
					secondAverageToken = cookie.Value
				}
			}

			assertNonNilID(t, user.ID, "second created user")
			assertNonNilID(t, translated.ID, "second average user login response")
		})

		t.Run("TestUpdateSecondUserToAdminAsAverageUser", func(t *testing.T) {
			jsonBody := []byte(`{"userID":"` + secondAverageUserID.String() + `","title": "admin"}`)
			_, _, err := NewRequestBuilderNoTarget("POST", jsonBody, http.StatusForbidden).WithPath("/admin/users/account_status").WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestUpdateSecondUserToAdminAsAdmin", func(t *testing.T) {
			jsonBody := []byte(`{"userID":"` + secondAverageUserID.String() + `","title": "admin"}`)
			res, _, err := NewRequestBuilder("POST", jsonBody, http.StatusOK, database.User{}).WithPath("/admin/users/account_status").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var user database.User
			if user = res.(database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			if UserPermissions(user.Permissions)&PermissionAdmin == 0 {
				t.Fatalf("Expected user to have admin permissions, got %v", user.Permissions)
			}

			assertNonNilID(t, user.ID, "promoted second user to admin")
		})

		t.Run("TestUpdateSecondUserToBasic", func(t *testing.T) {
			jsonBody := []byte(`{"userID":"` + secondAverageUserID.String() + `","title": "basic"}`)
			res, _, err := NewRequestBuilder("POST", jsonBody, http.StatusOK, database.User{}).WithPath("/admin/users/account_status").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var user database.User
			if user = res.(database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			if UserPermissions(user.Permissions)&PermissionAdmin != 0 {
				t.Fatalf("Expected user to not have admin permissions, got %v", user.Permissions)
			}

			assertNonNilID(t, user.ID, "demoted second user to basic")
		})

		t.Run("TestMakeSecondUserTeacher", func(t *testing.T) {
			jsonBody := []byte(`{"userID":"` + secondAverageUserID.String() + `","title": "teacher"}`)
			res, _, err := NewRequestBuilder("POST", jsonBody, http.StatusOK, database.User{}).WithPath("/admin/users/account_status").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var user database.User
			if user = res.(database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			if !(UserHasPermission(user, PermissionCanSuggestLessons) && user.Title == "teacher") {
				t.Fatalf("Expected user to have teacher permissions, got %v", user.Permissions)
			}

			assertNonNilID(t, user.ID, "updated second user to teacher")
		})

		//Test files
		uploadedFileID := uuid.Nil
		t.Run("TestUploadFile", func(t *testing.T) {
			type params struct {
				FileID   uuid.UUID `json:"file_id"`
				FilePath string    `json:"file_path"`
			}

			resp, _, err := NewRequestBuilder("POST", nil, http.StatusOK, params{}).WithPath("/api/upload?location=lessons").WithAuthToken(adminToken).WithGeneratedFile([]byte("This is a test file."), "file", "testfile.txt").Build()
			var responseParams params
			if responseParams = resp.(params); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if responseParams.FileID == uuid.Nil {
				t.Fatal("Expected non-nil file ID")
			}
			if responseParams.FilePath == "" {
				t.Fatal("Expected non-empty file path")
			}

			uploadedFileID = responseParams.FileID
		})

		/*
			===========================================

				Lesson Management Tests

			===========================================
		*/
		t.Run("TestUploadLessonWithoutAuth", func(t *testing.T) {
			jsonData := []byte(`{"title":"Test Lesson","description":"This is a test lesson.","content_id":"` + uploadedFileID.String() + `","class": 9, "module": 1, "section": 1}`)
			_, _, err := NewRequestBuilderNoTarget("POST", jsonData, http.StatusUnauthorized).WithPath("/api/lessons").BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		uploadedLessonID := uuid.Nil
		t.Run("TestUploadLessonWithAuth", func(t *testing.T) {
			jsonData := []byte(`{"title":"Test Lesson","description":"This is a test lesson.","content_id":"` + uploadedFileID.String() + `","class": 9, "module": 1, "section": 1, "language":"ro"}`)
			resp, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, LessonWithFlags{}).WithPath("/api/lessons").WithAuthToken(adminToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}
			assertNonNilID(t, lesson.Lesson.ID, "updated lesson flags")

			if lesson.Lesson.Title != "Test Lesson" {
				t.Fatalf("Expected lesson title %s, got %s", "Test Lesson", lesson.Lesson.Title)
			}
			if lesson.FlagTranslation.Class != 9 || lesson.FlagTranslation.Module != 1 || lesson.FlagTranslation.Section != 1 {
				t.Fatalf("Expected lesson flags class %d, module %d, section %d; got class %d, module %d, section %d", 9, 1, 1, lesson.FlagTranslation.Class, lesson.FlagTranslation.Module, lesson.FlagTranslation.Section)
			}
			if lesson.Lesson.Language != "ro" {
				t.Fatalf("Expected lesson language %s, got %s", "ro", lesson.Lesson.Language)
			}
			uploadedLessonID = lesson.Lesson.ID

			assertNonNilID(t, lesson.Lesson.ID, "uploaded lesson")
		})

		t.Run("TestUpdateLessonDetailsWithAuth", func(t *testing.T) {
			jsonData := []byte(`{"title":"Updated Test Lesson","description":"This is an updated test lesson."}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+uploadedLessonID.String()).WithQueryParam("target_field", "details").WithAuthToken(adminToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}
			assertNonNilID(t, lesson.Lesson.ID, "linked lesson creation response")

			if lesson.Lesson.Title != "Updated Test Lesson" {
				t.Fatalf("Expected lesson title %s, got %s", "Updated Test Lesson", lesson.Lesson.Title)
			}
			if lesson.Lesson.Description.String != "This is an updated test lesson." {
				t.Fatalf("Expected lesson description %s, got %s", "This is an updated test lesson.", lesson.Lesson.Description.String)
			}

			assertNonNilID(t, lesson.Lesson.ID, "updated lesson details")
		})

		t.Run("TestUpdateLessonFlagsWithAuth", func(t *testing.T) {
			jsonData := []byte(`{"class":10,"module":2,"section":3}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+uploadedLessonID.String()).WithQueryParam("target_field", "flags").WithAuthToken(adminToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if lesson.FlagTranslation.Class != 10 || lesson.FlagTranslation.Module != 2 || lesson.FlagTranslation.Section != 3 {
				t.Fatalf("Expected lesson flags class %d, module %d, section %d; got class %d, module %d, section %d", 10, 2, 3, lesson.FlagTranslation.Class, lesson.FlagTranslation.Module, lesson.FlagTranslation.Section)
			}
		})

		t.Run("TestUpdateLessonSectionStarterWithAuth", func(t *testing.T) {
			jsonData := []byte(`{"section_starter": true}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+uploadedLessonID.String()).WithQueryParam("target_field", "section_starter").WithAuthToken(adminToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if lesson.Lesson.SectionStarter != true {
				t.Fatalf("Expected lesson section starter %t, got %t", true, lesson.Lesson.SectionStarter)
			}

			assertNonNilID(t, lesson.Lesson.ID, "updated lesson section starter")
		})

		var fileIds []uuid.UUID
		t.Run("CreateFilesForLinkingTest", func(t *testing.T) {
			for i := 0; i < 26; i++ {
				type params struct {
					FileID   uuid.UUID `json:"file_id"`
					FilePath string    `json:"file_path"`
				}

				fileContent := []byte("This is test file number " + strconv.Itoa(i) + " for upload.")
				fileName := "file_upload_" + strconv.Itoa(i) + ".txt"
				resp, _, err := NewRequestBuilder("POST", nil, http.StatusOK, params{}).WithPath("/api/upload?location=lessons").WithAuthToken(adminToken).WithGeneratedFile(fileContent, "file", fileName).Build()

				var responseParams params
				if responseParams = resp.(params); err != nil {
					t.Fatal("Error decoding response: ", err)
				}

				if responseParams.FileID == uuid.Nil {
					t.Fatal("Expected non-nil file ID")
				}
				if responseParams.FilePath == "" {
					t.Fatal("Expected non-empty file path")
				}

				fileIds = append(fileIds, responseParams.FileID)
			}
		})

		t.Run("TestMakeSecondUserTeacher", func(t *testing.T) {
			jsonBody := []byte(`{"userID":"` + secondAverageUserID.String() + `","title": "teacher"}`)
			res, _, err := NewRequestBuilder("POST", jsonBody, http.StatusOK, database.User{}).WithPath("/admin/users/account_status").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var user database.User
			if user = res.(database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			if !(UserHasPermission(user, PermissionCanSuggestLessons) && user.Title == "teacher") {
				t.Fatalf("Expected user to have teacher permissions, got %v", user.Permissions)
			}

			assertNonNilID(t, user.ID, "updated second user to teacher")
		})

		t.Run("TestSuggestLessonAsAverageUserForbidden", func(t *testing.T) {
			jsonData := []byte(`{"title":"Forbidden Suggested Lesson","description":"This is a forbidden suggested lesson.","content_id":"` + fileIds[25].String() + `","class": 8, "module": 1, "section": 1}`)
			_, _, err := NewRequestBuilderNoTarget("POST", jsonData, http.StatusForbidden).WithPath("/api/lessons").WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		var suggestedLessonID uuid.UUID
		t.Run("TestSuggestLessonAsTeacher", func(t *testing.T) {
			jsonData := []byte(`{"title":"Suggested Lesson","description":"This is a suggested lesson.","content_id":"` + fileIds[25].String() + `","class": 8, "module": 1, "section": 1}`)
			resp, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, LessonWithFlags{}).WithPath("/api/lessons").WithAuthToken(secondAverageToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if lesson.Lesson.Title != "Suggested Lesson" {
				t.Fatalf("Expected lesson title %s, got %s", "Suggested Lesson", lesson.Lesson.Title)
			}
			if lesson.Lesson.Suggested != true {
				t.Fatalf("Expected lesson suggested %t, got %t", true, lesson.Lesson.Suggested)
			}
			suggestedLessonID = lesson.Lesson.ID

			assertNonNilID(t, lesson.Lesson.ID, "suggested lesson")
		})

		t.Run("TestUpdateLessonSuggestedForbidden", func(t *testing.T) {
			jsonData := []byte(`{"title":"Updated Suggested Lesson"}`)
			_, _, err := NewRequestBuilderNoTarget("PUT", jsonData, http.StatusUnauthorized).WithPath("/api/lessons/"+suggestedLessonID.String()).WithQueryParam("target_field", "details").WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestUpdateLessonSuggestedAsAdmin", func(t *testing.T) {
			jsonData := []byte(`{"title":"Updated Suggested Lesson"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+suggestedLessonID.String()).WithQueryParam("target_field", "details").WithAuthToken(adminToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if lesson.Lesson.Title != "Updated Suggested Lesson" {
				t.Fatalf("Expected lesson title %s, got %s", "Updated Suggested Lesson", lesson.Lesson.Title)
			}

			assertNonNilID(t, lesson.Lesson.ID, "updated suggested lesson as admin")
		})

		t.Run("TestUpdateLessonSuggestedAsAuthor", func(t *testing.T) {
			jsonData := []byte(`{"title":"Author Updated Suggested Lesson"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+suggestedLessonID.String()).WithQueryParam("target_field", "details").WithAuthToken(secondAverageToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if lesson.Lesson.Title != "Author Updated Suggested Lesson" {
				t.Fatalf("Expected lesson title %s, got %s", "Author Updated Suggested Lesson", lesson.Lesson.Title)
			}

			assertNonNilID(t, lesson.Lesson.ID, "updated suggested lesson as author")
		})

		t.Run("TestGetSuggestedLessons", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, []LessonWithFlags{}).WithPath("/admin/lessons/suggested").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var lessons []LessonWithFlags
			if lessons = resp.([]LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if len(lessons) < 1 {
				t.Fatal("No suggested lessons found")
			}

			for _, lesson := range lessons {
				assertNonNilID(t, lesson.Lesson.ID, "suggested lesson in admin list")
			}
		})

		t.Run("TestGetSuggestedLessonsByTeacher", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, []LessonWithFlags{}).WithPath("/admin/lessons/suggested").WithQueryParam("author_id", secondAverageUserID.String()).WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var lessons []LessonWithFlags
			if lessons = resp.([]LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if len(lessons) < 1 {
				t.Fatal("No suggested lessons found for the teacher")
			}

			for _, lesson := range lessons {
				assertNonNilID(t, lesson.Lesson.ID, "suggested lesson in teacher-filtered list")
			}
		})

		t.Run("TestApproveSuggestedLessonWithoutAuth", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("POST", nil, http.StatusForbidden).WithPath("/admin/lessons/suggested/" + suggestedLessonID.String() + "/approve").WithAuthToken(secondAverageToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestApproveLessonWithoutAuth", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("POST", nil, http.StatusForbidden).WithPath("/admin/lessons/suggested/" + suggestedLessonID.String() + "/approve").WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestApproveLessonWithoutAuth", func(t *testing.T) {
			res, _, err := NewRequestBuilder("POST", nil, http.StatusOK, LessonWithFlags{}).WithPath("/admin/lessons/suggested/" + suggestedLessonID.String() + "/approve").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var lesson LessonWithFlags
			if lesson = res.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if lesson.Lesson.Suggested != false {
				t.Fatalf("Lesson is suggested, expected to not be suggested")
			}

			assertNonNilID(t, lesson.Lesson.ID, "approved suggested lesson")
		})

		var lessonIds []uuid.UUID
		lessonIds = append(lessonIds, uploadedLessonID)
		t.Run("CreateMultipleLessonsForLinkingTest", func(t *testing.T) {
			for i := 0; i < 25; i++ {
				//t.Log("PrevLessonID: ", lessonIds[len(lessonIds)-1].String())
				jsonData := []byte(`{"title":"Linked Lesson ` + strconv.Itoa(i) + `","description":"This is linked lesson.","content_id":"` + fileIds[i].String() + `","class": 11, "module": 1, "section": ` + strconv.Itoa(69) + `,"previous": "` + lessonIds[len(lessonIds)-1].String() + `", "language": "en"}`)
				resp, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, LessonWithFlags{}).WithPath("/api/lessons").WithAuthToken(adminToken).Build()

				var lesson LessonWithFlags
				if lesson = resp.(LessonWithFlags); err != nil {
					t.Fatal("Error making request: ", err)
				}

				if lesson.Lesson.Title != "Linked Lesson "+strconv.Itoa(i) {
					t.Fatalf("Expected lesson title %s, got %s", "Linked Lesson "+strconv.Itoa(i), lesson.Lesson.Title)
				}

				if lesson.Lesson.PrevLessonID.Valid != true || lesson.Lesson.PrevLessonID.UUID != lessonIds[len(lessonIds)-1] {
					t.Fatalf("Expected lesson prev lesson ID %s, got %s", lessonIds[len(lessonIds)-1].String(), lesson.Lesson.PrevLessonID.UUID.String())
				}

				prevLesson, err := cfg.Db.GetLessonByID(context.Background(), lesson.Lesson.PrevLessonID.UUID)
				if err != nil {
					t.Fatal("Error getting previous lesson: ", err)
				}
				if prevLesson.NextLessonID.Valid != true || prevLesson.NextLessonID.UUID != lesson.Lesson.ID {
					t.Fatalf("Expected previous lesson next lesson ID %s, got %s", lesson.Lesson.ID.String(), prevLesson.NextLessonID.UUID.String())
				}

				lessonIds = append(lessonIds, lesson.Lesson.ID)
			}
		})

		t.Run("TestGetRequestsForLinkedLessons", func(t *testing.T) {
			for i := 0; i < 23; i++ {
				resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons").WithQueryParam("search_type", "id").WithQueryParam("lesson_id", lessonIds[i+1].String()).Build()
				if err != nil {
					t.Fatal("Error making request: ", err)
				}

				var lesson LessonWithFlags
				if lesson = resp.(LessonWithFlags); err != nil {
					t.Fatal("Error decoding response: ", err)
				}
				assertNonNilID(t, lesson.Lesson.ID, "linked lesson fetch response")

				if lesson.Lesson.PrevLessonID.Valid != true || lesson.Lesson.PrevLessonID.UUID != lessonIds[i] {
					t.Fatalf("Expected lesson prev lesson ID %s, got %s", lessonIds[i].String(), lesson.Lesson.PrevLessonID.UUID.String())
				}
				if lesson.Lesson.NextLessonID.Valid != true || lesson.Lesson.NextLessonID.UUID != lessonIds[i+2] {
					t.Fatalf("Expected lesson next lesson ID %s, got %s", lessonIds[i+2].String(), lesson.Lesson.NextLessonID.UUID.String())
				}
			}
		})

		t.Run("TestGetLessonsInSection69", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, []LessonWithFlags{}).WithPath("/api/lessons").WithQueryParam("search_type", "flags").WithQueryParam("section", "69").Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var lessons []LessonWithFlags
			if lessons = resp.([]LessonWithFlags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if len(lessons) != 25 {
				t.Logf("Expected %d lessons in section 69, got %d", 25, len(lessons))
			}

			for _, lesson := range lessons {
				assertNonNilID(t, lesson.Lesson.ID, "lesson in section search response")
			}
		})

		t.Run("UpdateLinkedLessonsSectionStarter", func(t *testing.T) {
			jsonData := []byte(`{"section_starter": true}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+lessonIds[2].String()).WithQueryParam("target_field", "section_starter").WithAuthToken(adminToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if lesson.Lesson.SectionStarter != true {
				t.Fatalf("Expected lesson section starter %t, got %t", true, lesson.Lesson.SectionStarter)
			}

			assertNonNilID(t, lesson.Lesson.ID, "updated linked lesson section starter")
		})

		//t.Log(lessonIds)

		t.Run("UpdateLessonsToLinkToEachOther", func(t *testing.T) {
			for i := 0; i < 25; i++ {
				//t.Log(lessonIds[i], lessonIds[i+1])
				jsonData := []byte(`{"next":"` + lessonIds[i+1].String() + `"}`)
				resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+lessonIds[i].String()).WithQueryParam("target_field", "next").WithAuthToken(adminToken).Build()

				var lesson LessonWithFlags
				if lesson = resp.(LessonWithFlags); err != nil {
					t.Fatal("Error making request: ", err)
				}
				assertNonNilID(t, lesson.Lesson.ID, "updated linked lesson next pointer")

				if lesson.Lesson.NextLessonID.Valid != true || lesson.Lesson.NextLessonID.UUID != lessonIds[i+1] {
					t.Fatalf("Expected lesson next lesson ID %s, got %s", lessonIds[i+1].String(), lesson.Lesson.NextLessonID.UUID.String())
				}
			}
		})

		t.Run("UnlinkFirstLesson", func(t *testing.T) {
			jsonData := []byte(`{"next":"00000000-0000-0000-0000-000000000000"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons/"+lessonIds[0].String()).WithQueryParam("target_field", "next").WithAuthToken(adminToken).Build()

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error making request: ", err)
			}
			assertNonNilID(t, lesson.Lesson.ID, "unlinked first lesson response")

			if lesson.Lesson.NextLessonID.Valid != false {
				t.Fatalf("Expected lesson next lesson ID to be null, got %v", lesson.Lesson.NextLessonID)
			}
		})

		t.Run("TestDeleteSectionStarterLesson", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusNoContent).WithPath("/api/lessons/" + lessonIds[1].String()).WithAuthToken(adminToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			//Verify that the next lesson no longer has a prev lesson ID
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons").WithQueryParam("search_type", "id").WithQueryParam("lesson_id", lessonIds[2].String()).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var lesson LessonWithFlags
			if lesson = resp.(LessonWithFlags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, lesson.Lesson.ID, "lesson fetched after deleting section starter")

			if lesson.Lesson.SectionStarter != true {
				t.Fatalf("Expected lesson section starter %t, got %t", true, lesson.Lesson.SectionStarter)
			}
			if lesson.Lesson.PrevLessonID.Valid != false {
				t.Fatalf("Expected lesson previous lesson ID to be null, got %v", lesson.Lesson.PrevLessonID)
			}
		})

		t.Run("TestDeleteNonExistentLesson", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusInternalServerError).WithPath("/api/lessons/00000000-0000-0000-0000-000000000000").WithAuthToken(adminToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestGetDeletedLesson", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("GET", nil, http.StatusInternalServerError).WithPath("/api/lessons").WithQueryParam("search_type", "id").WithQueryParam("lesson_id", lessonIds[1].String()).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestGetLessonsByAverageUser", func(t *testing.T) {
			for i := 0; i < 3; i++ {
				resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, LessonWithFlags{}).WithPath("/api/lessons").WithQueryParam("search_type", "id").WithQueryParam("lesson_id", lessonIds[i+2].String()).WithAuthToken(secondAverageToken).Build()
				if err != nil {
					t.Fatal("Error making request: ", err)
				}

				var lesson LessonWithFlags
				if lesson = resp.(LessonWithFlags); err != nil {
					t.Fatal("Error decoding response: ", err)
				}

				if lesson.Lesson.ID != lessonIds[i+2] {
					t.Fatalf("Expected lesson ID %s, got %s", lessonIds[i+2].String(), lesson.Lesson.ID.String())
				}

				assertNonNilID(t, lesson.Lesson.ID, "problem in average user list")
			}
		})

		t.Run("TestDeleteLessonAsAverageUser", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusForbidden).WithPath("/api/lessons/" + uploadedLessonID.String()).WithAuthToken(secondAverageToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestDeleteLessonAsAdmin", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusNoContent).WithPath("/api/lessons/" + uploadedLessonID.String()).WithAuthToken(adminToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		/*
			===========================================

				Problem Test Management Tests

			===========================================
		*/
		t.Run("TestCreateProblemTestWithoutAdmin", func(t *testing.T) {
			jsonData := []byte(`{"input_text":"2 3\n","expected_output":"5\n"}`)
			_, _, err := NewRequestBuilderNoTarget("POST", jsonData, http.StatusForbidden).WithPath("/api/tests").WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestCreateProblemTestWithoutAuth", func(t *testing.T) {
			jsonData := []byte(`{"input_text":"","expected_output":"5\n"}`)
			_, _, err := NewRequestBuilderNoTarget("POST", jsonData, http.StatusUnauthorized).WithPath("/api/tests").BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		var testID uuid.UUID
		t.Run("TestCreateProblemTest", func(t *testing.T) {
			jsonData := []byte(`{"input_text":"2 3\n","expected_output":"5\n"}`)
			resp, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, database.CodeTest{}).WithPath("/api/tests").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var test database.CodeTest
			if test = resp.(database.CodeTest); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, test.ID, "created problem test")

			if !test.TxtInput.Valid {
				t.Fatal("Expected input text to be valid")
			}
			if test.TxtInput.String != "2 3\n" {
				t.Fatalf("Expected input text %v, got %v", "2 3\n", test.TxtInput)
			}
			if test.ExpectedOutput != "5\n" {
				t.Fatalf("Expected output %s, got %s", "5\n", test.ExpectedOutput)
			}
			testID = test.ID
		})

		t.Run("TestGetProblemTestByID", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, database.CodeTest{}).WithPath("/api/tests/" + testID.String()).WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var test database.CodeTest
			if test = resp.(database.CodeTest); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, test.ID, "fetched problem test by id")

			if test.ID != testID {
				t.Fatalf("Expected test ID %s, got %s", testID.String(), test.ID.String())
			}
		})

		t.Run("TestUpdateProblemTestInput", func(t *testing.T) {
			jsonData := []byte(`{"input_text":"10 20\n"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, database.CodeTest{}).WithPath("/api/tests/"+testID.String()).WithQueryParam("target_field", "input").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var test database.CodeTest
			if test = resp.(database.CodeTest); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, test.ID, "updated problem test input")

			if !test.TxtInput.Valid {
				t.Fatal("Expected input text to be valid")
			}
			if test.TxtInput.String != "10 20\n" {
				t.Fatalf("Expected input text %v, got %v", "10 20\n", test.TxtInput)
			}
		})

		t.Run("TestUpdateProblemTestExpectedOutput", func(t *testing.T) {
			jsonData := []byte(`{"expected_output":"10 20\n"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, database.CodeTest{}).WithPath("/api/tests/"+testID.String()).WithQueryParam("target_field", "expected_output").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var test database.CodeTest
			if test = resp.(database.CodeTest); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, test.ID, "updated problem test expected output")

			if test.ExpectedOutput != "10 20\n" {
				t.Fatalf("Expected output %s, got %s", "10 20\n", test.ExpectedOutput)
			}
		})

		var testIds []uuid.UUID
		testIds = append(testIds, testID)
		t.Run("TestCreateMultipleProblemTestsForLinking", func(t *testing.T) {
			for i := 0; i < 25; i++ {
				jsonData := []byte(`{"input_text":"Input ` + strconv.Itoa(i) + `\n","expected_output":"Output ` + strconv.Itoa(i) + `\n","previous_test_id":"` + testIds[i].String() + `"}`)
				resp, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, database.CodeTest{}).WithPath("/api/tests").WithAuthToken(adminToken).Build()
				if err != nil {
					t.Fatal("Error making request: ", err)
				}

				var test database.CodeTest
				if test = resp.(database.CodeTest); err != nil {
					t.Fatal("Error decoding response: ", err)
				}
				assertNonNilID(t, test.ID, "created linked problem test")

				if !test.TxtInput.Valid {
					t.Fatal("Expected input text to be valid")
				}
				if test.TxtInput.String != "Input "+strconv.Itoa(i)+"\n" {
					t.Fatalf("Expected input text %v, got %v", "Input "+strconv.Itoa(i)+"\n", test.TxtInput)
				}
				if test.ExpectedOutput != "Output "+strconv.Itoa(i)+"\n" {
					t.Fatalf("Expected output %s, got %s", "Output "+strconv.Itoa(i)+"\n", test.ExpectedOutput)
				}
				if test.PreviousTestID.Valid != true || test.PreviousTestID.UUID != testIds[i] {
					t.Fatalf("Expected previous test ID %s, got %s", testIds[i].String(), test.PreviousTestID.UUID.String())
				}

				testIds = append(testIds, test.ID)
			}
		})

		t.Run("TestGetTestsInSequence", func(t *testing.T) {
			for i := 0; i < 23; i++ {
				resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, database.CodeTest{}).WithPath("/api/tests/" + testIds[i+1].String()).WithAuthToken(adminToken).Build()
				if err != nil {
					t.Fatal("Error making request: ", err)
				}

				var test database.CodeTest
				if test = resp.(database.CodeTest); err != nil {
					t.Fatal("Error decoding response: ", err)
				}
				assertNonNilID(t, test.ID, "fetched linked problem test")

				if test.PreviousTestID.Valid != true || test.PreviousTestID.UUID != testIds[i] {
					t.Fatalf("Expected previous test ID %s, got %s", testIds[i].String(), test.PreviousTestID.UUID.String())
				}
				if test.NextTestID.Valid != true || test.NextTestID.UUID != testIds[i+2] {
					t.Fatalf("Expected next test ID %s, got %s", testIds[i+2].String(), test.NextTestID.UUID.String())
				}
			}
		})

		/*
			===========================================

				Problem Management Tests

			===========================================
		*/
		var problemID uuid.UUID
		t.Run("TestCreateProblem", func(t *testing.T) {
			jsonData := []byte(`{"title":"Sample Problem","description":"This is a test problem", "source":"ONI2025", "first_test_id":"` + testID.String() + `","difficulty":3, "module": 1, "section": 2}`)
			resp, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, ProblemWithTags{}).WithPath("/api/problems").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var problem ProblemWithTags
			if problem = resp.(ProblemWithTags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, problem.Problem.ID, "fetched problem by id")

			if problem.Problem.Title != "Sample Problem" {
				t.Fatalf("Expected problem title %s, got %s", "Sample Problem", problem.Problem.Title)
			}
			if problem.Problem.FirstTest.Valid != true || problem.Problem.FirstTest.UUID != testID {
				t.Fatalf("Expected problem first test ID %s, got %s", testID.String(), problem.Problem.FirstTest.UUID.String())
			}
			problemID = problem.Problem.ID

			assertNonNilID(t, problem.Problem.ID, "created problem")
		})

		t.Run("TestDeleteProblemAsAverageUser", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusForbidden).WithPath("/api/problems/" + problemID.String()).WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		var suggestedProblemID uuid.UUID
		t.Run("TestCreateProblemAsTeacher", func(t *testing.T) {
			jsonData := []byte(`{"title":"Teacher Problem","description":"This is a test problem created by a teacher", "source":"ONI2025", "first_test_id":"` + testID.String() + `","difficulty":3, "module": 1, "section": 2}`)
			res, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, ProblemWithTags{}).WithPath("/api/problems").WithAuthToken(secondAverageToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			var problem ProblemWithTags
			if problem = res.(ProblemWithTags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if problem.Problem.Suggested != true {
				t.Fatalf("Expected problem suggested %t, got %t", true, problem.Problem.Suggested)
			}
			suggestedProblemID = problem.Problem.ID

			assertNonNilID(t, problem.Problem.ID, "created teacher problem")
		})

		t.Run("TestUpdateSuggestedProblemAsAverageUser", func(t *testing.T) {
			jsonData := []byte(`{"title":"Updated Teacher Problem"}`)
			_, _, err := NewRequestBuilderNoTarget("PUT", jsonData, http.StatusUnauthorized).WithPath("/api/problems/"+suggestedProblemID.String()).WithQueryParam("target_field", "details").WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestUpdateSuggestedProblemAsTeacher", func(t *testing.T) {
			jsonData := []byte(`{"title":"Updated Teacher Problem", "description":"This is an updated teacher test problem", "source":"ONI2026"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, ProblemWithTags{}).WithPath("/api/problems/"+suggestedProblemID.String()).WithQueryParam("target_field", "details").WithAuthToken(secondAverageToken).Build()

			var problem ProblemWithTags
			if problem = resp.(ProblemWithTags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if problem.Problem.Title != "Updated Teacher Problem" {
				t.Fatalf("Expected problem title %s, got %s", "Updated Teacher Problem", problem.Problem.Title)
			}

			assertNonNilID(t, problem.Problem.ID, "updated suggested problem as teacher")
		})

		t.Run("TestApproveSuggestedProblemWithoutAuth", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("POST", nil, http.StatusForbidden).WithPath("/admin/problems/suggested/" + suggestedProblemID.String() + "/approve").WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestApproveSuggestedProblemAsAdmin", func(t *testing.T) {
			res, _, err := NewRequestBuilder("POST", nil, http.StatusOK, ProblemWithTags{}).WithPath("/admin/problems/suggested/" + suggestedProblemID.String() + "/approve").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var problem ProblemWithTags
			if problem = res.(ProblemWithTags); err != nil {
				t.Fatal("Error making request: ", err)
			}

			if problem.Problem.Suggested != false {
				t.Fatalf("Problem is suggested, expected to not be suggested")
			}

			assertNonNilID(t, problem.Problem.ID, "approved suggested problem")
		})

		t.Run("TestGetProblemByID", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, ProblemWithTags{}).WithPath("/api/problems").WithQueryParam("search_type", "id").WithQueryParam("problem_id", problemID.String()).WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var problem ProblemWithTags
			if problem = resp.(ProblemWithTags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if problem.Problem.ID != problemID {
				t.Fatalf("Expected problem ID %s, got %s", problemID.String(), problem.Problem.ID.String())
			}
		})

		t.Run("GetProblemsByAverageUser", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, []ProblemWithTags{}).WithPath("/api/problems").WithAuthToken(averageUserToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var problems []ProblemWithTags
			if problems = resp.([]ProblemWithTags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			found := false
			for _, problem := range problems {
				assertNonNilID(t, problem.Problem.ID, "problem in average user list")
				if problem.Problem.ID == problemID {
					found = true
					break
				}
			}
			if !found {
				t.Fatalf("Expected to find problem with ID %s", problemID.String())
			}

			assertNonNilID(t, problemID, "problem in average user list")
		})

		t.Run("TestUpdateProblemDetails", func(t *testing.T) {
			jsonData := []byte(`{"title":"Updated Sample Problem","description":"This is an updated test problem"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, ProblemWithTags{}).WithPath("/api/problems/"+problemID.String()).WithQueryParam("target_field", "details").WithAuthToken(adminToken).Build()

			var problem ProblemWithTags
			if problem = resp.(ProblemWithTags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, problem.Problem.ID, "updated problem tags")

			if problem.Problem.Title != "Updated Sample Problem" {
				t.Fatalf("Expected problem title %s, got %s", "Updated Sample Problem", problem.Problem.Title)
			}

			assertNonNilID(t, problem.Problem.ID, "updated problem details")
		})

		t.Run("TestUpdateProblemTags", func(t *testing.T) {
			jsonData := []byte(`{"difficulty":5,"module":3,"section":4}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, ProblemWithTags{}).WithPath("/api/problems/"+problemID.String()).WithQueryParam("target_field", "tags").WithAuthToken(adminToken).Build()

			var problem ProblemWithTags
			if problem = resp.(ProblemWithTags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, problem.Problem.ID, "updated problem first test")

			if problem.TagTranslation.Difficulty != 5 || problem.TagTranslation.Module != 3 || problem.TagTranslation.Section != 4 {
				t.Fatalf("Expected problem tags difficulty %d, module %d, section %d; got difficulty %d, module %d, section %d", 5, 3, 4, problem.TagTranslation.Difficulty, problem.TagTranslation.Module, problem.TagTranslation.Section)
			}
		})

		t.Run("TestUpdateProblemFirstTest", func(t *testing.T) {
			jsonData := []byte(`{"first_test_id":"` + testIds[5].String() + `"}`)
			resp, _, err := NewRequestBuilder("PUT", jsonData, http.StatusOK, ProblemWithTags{}).WithPath("/api/problems/"+problemID.String()).WithQueryParam("target_field", "test").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var problem ProblemWithTags
			if problem = resp.(ProblemWithTags); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if problem.Problem.FirstTest.Valid != true || problem.Problem.FirstTest.UUID != testIds[5] {
				t.Fatalf("Expected problem first test ID %s, got %s", testIds[5].String(), problem.Problem.FirstTest.UUID.String())
			}
		})

		/*
			===========================================

				Solution Management Tests

			===========================================
		*/

		var solutionID uuid.UUID
		t.Run("TestCreateSolutionAsUser", func(t *testing.T) {
			jsonData := []byte(`{"problem_id":"` + problemID.String() + `","code":"print(input())","language":"python"}`)
			resp, _, err := NewRequestBuilder("POST", jsonData, http.StatusCreated, database.Solution{}).WithPath("/api/solutions").WithAuthToken(secondAverageToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var sol database.Solution
			if sol = resp.(database.Solution); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, sol.ID, "created solution")
			if sol.ProblemID != problemID {
				t.Fatalf("Expected solution problem ID %s, got %s", problemID.String(), sol.ProblemID.String())
			}
			if sol.Language != "python" {
				t.Fatalf("Expected solution language %s, got %s", "python", sol.Language)
			}
			if sol.SentCode != "print(input())" {
				t.Fatalf("Expected solution code %s, got %s", "print(input())", sol.SentCode)
			}
			solutionID = sol.ID
		})

		t.Run("TestGetSolutionByIDAsAdmin", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, database.Solution{}).WithPath("/api/solutions").WithAuthToken(adminToken).WithQueryParam("search_type", "id").WithQueryParam("solution_id", solutionID.String()).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var sol database.Solution
			if sol = resp.(database.Solution); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, sol.ID, "fetched solution by id as admin")
			if sol.Language != "python" {
				t.Fatalf("Expected solution language %s, got %s", "python", sol.Language)
			}
			if sol.SentCode != "print(input())" {
				t.Fatalf("Expected solution code %s, got %s", "print(input())", sol.SentCode)
			}
		})

		t.Run("TestGetSolutionByIDAsUser", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, database.Solution{}).WithPath("/api/solutions").WithAuthToken(secondAverageToken).WithQueryParam("search_type", "id").WithQueryParam("solution_id", solutionID.String()).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var sol database.Solution
			if sol = resp.(database.Solution); err != nil {
				t.Fatal("Error decoding response: ", err)
			}
			assertNonNilID(t, sol.ID, "fetched solution by id as user")
			if sol.Language != "python" {
				t.Fatalf("Expected solution language %s, got %s", "python", sol.Language)
			}
			if sol.SentCode != "print(input())" {
				t.Fatalf("Expected solution code %s, got %s", "print(input())", sol.SentCode)
			}
		})

		t.Run("TestGetSolutionByIDAsOtherUser", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("GET", nil, http.StatusForbidden).WithPath("/api/solutions").WithAuthToken(averageUserToken).WithQueryParam("search_type", "id").WithQueryParam("solution_id", solutionID.String()).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestBookmarkProblemAsUser", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("POST", nil, http.StatusOK).WithPath("/api/problems/" + problemID.String() + "/bookmark").WithAuthToken(secondAverageToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestLikeProblemAsUser", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("POST", nil, http.StatusOK).WithPath("/api/problems/" + problemID.String() + "/like").WithAuthToken(secondAverageToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestGetBookmarkedProblemsAsUser", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, []database.UsersProblem{}).WithPath("/api/users/" + secondAverageUserID.String() + "/bookmarked_problems").WithAuthToken(secondAverageToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var problems []database.UsersProblem
			if problems = resp.([]database.UsersProblem); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			found := false
			for _, problem := range problems {
				if problem.ProblemID == problemID {
					found = true
					break
				}
			}
			if !found {
				t.Fatalf("Expected to find bookmarked problem with ID %s", problemID.String())
			}
		})

		/*
			===========================================

				Cleanup Tests

			===========================================
		*/

		t.Run("TestDeleteProblemAsAdmin", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusNoContent).WithPath("/api/problems/" + problemID.String()).WithAuthToken(adminToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestGetDeletedProblem", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("GET", nil, http.StatusInternalServerError).WithPath("/api/problems").WithQueryParam("search_type", "id").WithQueryParam("problem_id", problemID.String()).WithAuthToken(adminToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestDeleteProblemTest", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusNoContent).WithPath("/api/tests/" + testID.String()).WithAuthToken(adminToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestDeleteAdminAsAverageUser", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusForbidden).WithPath("/api/users/" + adminID.String()).WithAuthToken(averageUserToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestDeleteUserAsOtherUser", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusForbidden).WithPath("/api/users/" + averageUserID.String()).WithAuthToken(secondAverageToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestDeleteAverageUserAsAdmin", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusNoContent).WithPath("/api/users/" + averageUserID.String()).WithAuthToken(adminToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestDeleteUserAsThemselves", func(t *testing.T) {
			_, _, err := NewRequestBuilderNoTarget("DELETE", nil, http.StatusNoContent).WithPath("/api/users/" + secondAverageUserID.String()).WithAuthToken(secondAverageToken).BuildRaw()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
		})

		t.Run("TestGetUsersAfterDeletions", func(t *testing.T) {
			resp, _, err := NewRequestBuilder("GET", nil, http.StatusOK, []database.User{}).WithPath("/api/users").WithAuthToken(adminToken).Build()
			if err != nil {
				t.Fatal("Error making request: ", err)
			}

			var users []database.User
			if users = resp.([]database.User); err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			for _, user := range users {
				if user.ID == averageUserID || user.ID == secondAverageUserID {
					t.Fatalf("Did not expect to find deleted user with ID %s", user.ID.String())
				}
			}
		})
	})

	t.Run("CliTests", func(t *testing.T) {
		// Call CLI-related test functions here
	})

	t.Run("VulnerabilityTests", func(t *testing.T) {
		// Call vulnerability-related test functions here
	})

	t.Run("TestAuthorizedReset", func(t *testing.T) {
		if cfg.WebsiteState == "production" {
			t.Log("Skipping reset test in production environment")
			return
		}

		_, _, err := NewRequestBuilderNoTarget("POST", nil, http.StatusOK).WithPath("/admin/reset").WithAuthToken(adminToken).BuildRaw()
		if err != nil {
			t.Fatal("Error making request: ", err)
		}
	})
}
