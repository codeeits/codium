package main

//This file is going to contain tests for the entire application stack, divided into sections for each major component.

import (
	"Codium/internal/database"
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

func TestSuiteStart(t *testing.T) {
	cfg := &ApiCfg{}
	cfg.TestSuite(t)
}

func (cfg *ApiCfg) TestSuite(t *testing.T) {
	t.Run(".envTests", func(t *testing.T) {
		// Call .env-related test functions here
		err := godotenv.Load()
		if err != nil {
			t.Fatal("Error loading .env file")
		} else {
			cfg.dbUrl = os.Getenv("DB_URL")
			cfg.secret = os.Getenv("SECRET")
			cfg.adminDefaultPassword = os.Getenv("ADMIN_DEFAULT_PASSWORD")
			cfg.smtpUrl = os.Getenv("SMTP_URL")
			cfg.smtpPort = 587 // Default SMTP port
			cfg.smtpUser = os.Getenv("SMTP_USER")
			cfg.smtpPassword = os.Getenv("SMTP_PASSWORD")
			cfg.websiteUrl = os.Getenv("WEBSITE_URL")
			cfg.websiteState = os.Getenv("WEBSITE_STATE")

			if cfg.websiteState == "" {
				//website state is MANDATORY; it determines whether the website resets at the end of testing suite
				t.Fatal("No website state provided")
			}
			if cfg.secret == "" {
				t.Log("No secret provided")
				t.Fail()
			}
			if cfg.dbUrl == "" {
				t.Log("No db url provided")
				t.Fail()
			}
			if cfg.adminDefaultPassword == "" {
				t.Log("No admin default password provided")
				t.Fail()
			}
			if cfg.smtpUrl == "" {
				t.Log("No SMTP url provided")
				t.Fail()
			}
			if cfg.smtpUser == "" {
				t.Log("No SMTP user provided")
				t.Fail()
			}
			if cfg.smtpPassword == "" {
				t.Log("No SMTP password provided")
				t.Fail()
			}
			if cfg.websiteUrl == "" {
				t.Log("No website url provided")
				t.Fail()
			}
		}
	})

	t.Run("DatabaseTests", func(t *testing.T) {
		db, err := sql.Open("postgres", cfg.dbUrl)
		if err != nil {
			t.Fatal("Error connecting to the database: ", err)
		}

		err = db.Ping()
		if err != nil {
			t.Fatal("Error pinging database: ", err)
		}

		cfg.db = database.New(db)
		cfg.dbLoaded = true
		t.Log("Successfully connected to the database!")
	})

	var adminToken string
	var adminRefreshToken string
	var adminID uuid.UUID
	t.Run("ApiTests", func(t *testing.T) {
		// Call API-related test functions here
		if !cfg.dbLoaded {
			return
		}

		client := &http.Client{}

		t.Run("TestStaticFileServing", func(t *testing.T) {
			req, err := http.NewRequest("GET", "http://localhost:6767/app/", nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}
		})

		t.Run("TestGetDefaultAdminUser", func(t *testing.T) {
			jsonBody := []byte(`{"email":"codiumOfficial@lekas.tech","password":"` + cfg.adminDefaultPassword + `"}`)

			req, err := http.NewRequest("POST", "http://localhost:6767/api/login", bytes.NewReader(jsonBody))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var params struct {
				User         database.User `json:"user"`
				Token        string        `json:"auth_token"`
				RefreshToken string        `json:"refresh_token"`
			}
			err = json.NewDecoder(resp.Body).Decode(&params)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if params.User.IsAdmin != true {
				t.Fatalf("Expected isAdmin %t, got %t", true, params.User.IsAdmin)
			}
			if params.Token == "" {
				t.Fatal("Expected non-empty token")
			}
			if params.RefreshToken == "" {
				t.Fatal("Expected non-empty refresh token")
			}
			adminToken = params.Token
			adminRefreshToken = params.RefreshToken
			adminID = params.User.ID
		})

		var averageUserEmail = "testing@nthing.com"
		var averageUserPassword = "TestPassword123!"
		var averageUserID uuid.UUID
		t.Run("TestCreateUser", func(t *testing.T) {
			var averageUserUsername = "TestUser"
			jsonBody := []byte(`{"email":"` + averageUserEmail + `","password":"` + averageUserPassword + `","username":"` + averageUserUsername + `"}"`)
			req, err := http.NewRequest("POST", "http://localhost:6767/api/create_user", bytes.NewReader(jsonBody))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusCreated {
				t.Fatalf("Expected status code %d, got %d", http.StatusCreated, resp.StatusCode)
			}

			var user database.User
			err = json.NewDecoder(resp.Body).Decode(&user)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if user.Email != averageUserEmail {
				t.Fatalf("Expected email %s, got %s", averageUserEmail, user.Email)
			}
			if user.Username != averageUserUsername {
				t.Fatalf("Expected username %s, got %s", averageUserUsername, user.Username)
			}
			if user.IsAdmin != false {
				t.Fatalf("Expected isAdmin %t, got %t", false, user.IsAdmin)
			}
		})

		var averageUserToken string
		t.Run("TestLoginUser", func(t *testing.T) {
			jsonBody := []byte(`{"email":"` + averageUserEmail + `","password":"` + averageUserPassword + `"}`)
			req, err := http.NewRequest("POST", "http://localhost:6767/api/login", bytes.NewReader(jsonBody))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var params struct {
				User         database.User `json:"user"`
				Token        string        `json:"auth_token"`
				RefreshToken string        `json:"refresh_token"`
			}
			err = json.NewDecoder(resp.Body).Decode(&params)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if params.User.Email != averageUserEmail {
				t.Fatalf("Expected email %s, got %s", averageUserEmail, params.User.Email)
			}
			if params.Token == "" {
				t.Fatal("Expected non-empty token")
			}
			if params.RefreshToken == "" {
				t.Fatal("Expected non-empty refresh token")
			}
			averageUserToken = params.Token
			averageUserID = params.User.ID
		})

		t.Run("TestUnauthorizedReset", func(t *testing.T) {
			req, err := http.NewRequest("POST", "http://localhost:6767/admin/reset", nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+averageUserToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusForbidden {
				t.Fatalf("Expected status code %d, got %d", http.StatusForbidden, resp.StatusCode)
			}
		})

		t.Run("TestUpdatingProfileBeforeTokenRefresh", func(t *testing.T) {
			jsonBody := []byte(`{"username":"UpdatedAdminUser"}`)
			req, err := http.NewRequest("PUT", "http://localhost:6767/api/users?target_field=username", bytes.NewReader(jsonBody))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var user database.User
			err = json.NewDecoder(resp.Body).Decode(&user)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if user.Username != "UpdatedAdminUser" {
				t.Fatalf("Expected username %s, got %s", "UpdatedAdminUser", user.Username)
			}
		})

		t.Run("TestRefreshToken", func(t *testing.T) {
			jsonBody := []byte(`{"refresh_token":"` + adminRefreshToken + `"}`)
			req, err := http.NewRequest("POST", "http://localhost:6767/api/refresh", bytes.NewReader(jsonBody))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var params struct {
				Token string `json:"auth_token"`
			}
			err = json.NewDecoder(resp.Body).Decode(&params)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if params.Token == "" {
				t.Fatal("Expected non-empty token")
			}
			adminToken = params.Token
		})

		t.Run("TestUpdatingProfileAfterTokenRefresh", func(t *testing.T) {
			jsonBody := []byte(`{"username":"RefreshedAdminUser"}`)
			req, err := http.NewRequest("PUT", "http://localhost:6767/api/users?target_field=username", bytes.NewReader(jsonBody))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var user database.User
			err = json.NewDecoder(resp.Body).Decode(&user)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if user.Username != "RefreshedAdminUser" {
				t.Fatalf("Expected username %s, got %s", "RefreshedAdminUser", user.Username)
			}
		})

		t.Run("TestGetUsers", func(t *testing.T) {
			req, err := http.NewRequest("GET", "http://localhost:6767/api/users", nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var users []database.User
			err = json.NewDecoder(resp.Body).Decode(&users)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if len(users) < 2 {
				t.Fatalf("Expected at least %d users, got %d", 2, len(users))
			}

			for _, user := range users {
				if user.PasswordHash != "" {
					t.Fatalf("Expected password hash to be omitted, got %s", user.PasswordHash)
				}
			}
		})

		t.Run("TestDeleteAdminAsAverageUser", func(t *testing.T) {
			req, err := http.NewRequest("DELETE", "http://localhost:6767/api/users/"+adminID.String(), nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Authorization", "Bearer "+averageUserToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusForbidden {
				t.Fatalf("Expected status code %d, got %d", http.StatusForbidden, resp.StatusCode)
			}
		})

		var secondAverageUserID uuid.UUID
		var secondAverageUserEmail = "second@hello.world"
		var secondAverageToken string
		t.Run("TestCreateSecondAverageUser", func(t *testing.T) {
			var secondAverageUsername = "SecondAverageUser"
			var secondAveragePassword = "AnotherPassword123!"
			jsonBody := []byte(`{"email":"` + secondAverageUserEmail + `","password":"` + secondAveragePassword + `","username":"` + secondAverageUsername + `"}"`)
			req, err := http.NewRequest("POST", "http://localhost:6767/api/create_user", bytes.NewReader(jsonBody))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusCreated {
				t.Fatalf("Expected status code %d, got %d", http.StatusCreated, resp.StatusCode)
			}

			var user database.User
			err = json.NewDecoder(resp.Body).Decode(&user)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if user.Email != secondAverageUserEmail {
				t.Fatalf("Expected email %s, got %s", secondAverageUserEmail, user.Email)
			}
			secondAverageUserID = user.ID

			// Now log in the second average user to get their token
			loginBody := []byte(`{"email":"` + secondAverageUserEmail + `","password":"` + secondAveragePassword + `"}`)
			loginReq, err := http.NewRequest("POST", "http://localhost:6767/api/login", bytes.NewReader(loginBody))
			if err != nil {
				t.Fatal("Error creating login request: ", err)
			}
			loginReq.Header.Set("Content-Type", "application/json")

			loginResp, err := client.Do(loginReq)
			if err != nil {
				t.Fatal("Error making login request: ", err)
			}
			defer loginResp.Body.Close()

			if loginResp.StatusCode != http.StatusOK {
				t.Fatalf("Expected login status code %d, got %d", http.StatusOK, loginResp.StatusCode)
			}

			var loginParams struct {
				User         database.User `json:"user"`
				Token        string        `json:"auth_token"`
				RefreshToken string        `json:"refresh_token"`
			}
			err = json.NewDecoder(loginResp.Body).Decode(&loginParams)
			if err != nil {
				t.Fatal("Error decoding login response: ", err)
			}

			secondAverageToken = loginParams.Token
		})

		t.Run("TestDeleteUserAsOtherUser", func(t *testing.T) {
			req, err := http.NewRequest("DELETE", "http://localhost:6767/api/users/"+averageUserID.String(), nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Authorization", "Bearer "+secondAverageToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusForbidden {
				t.Fatalf("Expected status code %d, got %d", http.StatusForbidden, resp.StatusCode)
			}
		})

		t.Run("TestDeleteAverageUserAsAdmin", func(t *testing.T) {
			req, err := http.NewRequest("DELETE", "http://localhost:6767/api/users/"+averageUserID.String(), nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}
		})

		//Test files
		uploadedFileID := uuid.Nil
		t.Run("TestUploadFile", func(t *testing.T) {
			cwd, _ := os.Getwd()
			folderPath := cwd + "/out/test_resources/"
			filePath := cwd + "/out/test_resources/file_upload.txt"
			err := os.MkdirAll(folderPath, 0755)
			if err != nil {
				t.Fatal("Error creating test resources directory: ", err)
			}
			defer os.RemoveAll(cwd + "/out/test_resources/")

			fileContent := []byte("This is a test file for upload.")
			err = os.WriteFile(filePath, fileContent, 0644)
			if err != nil {
				t.Fatal("Error creating test file: ", err)
			}
			fileData, err := os.Open(filePath)
			if err != nil {
				t.Fatal("Error opening test file: ", err)
			}

			var requestFileData bytes.Buffer

			writer := multipart.NewWriter(&requestFileData)
			part, err := writer.CreateFormFile("file", "file_upload.txt")
			if err != nil {
				t.Fatal("Error creating form file: ", err)
			}

			_, err = io.Copy(part, fileData)
			if err != nil {
				t.Fatal("Error copying file data: ", err)
			}
			err = writer.Close()
			if err != nil {
				t.Fatal("Error closing writer: ", err)
			}

			req, err := http.NewRequest("POST", "http://localhost:6767/api/upload?location=lessons", &requestFileData)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			type params struct {
				FileID   uuid.UUID `json:"file_id"`
				FilePath string    `json:"file_path"`
			}

			var responseParams params
			err = json.NewDecoder(resp.Body).Decode(&responseParams)
			if err != nil {
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

		t.Run("TestUploadLessonWithoutAuth", func(t *testing.T) {
			jsonData := []byte(`{"title":"Test Lesson","description":"This is a test lesson.","content_id":"` + uploadedFileID.String() + `","class": 9, "module": 1, "section": 1}`)
			req, err := http.NewRequest("POST", "http://localhost:6767/api/lessons", bytes.NewReader(jsonData))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+secondAverageToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusForbidden {
				t.Fatalf("Expected status code %d, got %d", http.StatusForbidden, resp.StatusCode)
			}
		})

		//	uploadedLessonID := uuid.Nil
		t.Run("TestUploadLessonWithAuth", func(t *testing.T) {
			jsonData := []byte(`{"title":"Test Lesson","description":"This is a test lesson.","content_id":"` + uploadedFileID.String() + `","class": 9, "module": 1, "section": 1}`)
			req, err := http.NewRequest("POST", "http://localhost:6767/api/lessons", bytes.NewReader(jsonData))
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusCreated {
				t.Fatalf("Expected status code %d, got %d", http.StatusCreated, resp.StatusCode)
			}

			var lesson LessonWithFlags
			err = json.NewDecoder(resp.Body).Decode(&lesson)
			if err != nil {
				t.Fatal("Error decoding response: ", err)
			}

			if lesson.Lesson.Title != "Test Lesson" {
				t.Fatalf("Expected lesson title %s, got %s", "Test Lesson", lesson.Lesson.Title)
			}
			if lesson.FlagTranslation.Class != 9 || lesson.FlagTranslation.Module != 1 || lesson.FlagTranslation.Section != 1 {
				t.Fatalf("Expected lesson flags class %d, module %d, section %d; got class %d, module %d, section %d", 9, 1, 1, lesson.FlagTranslation.Class, lesson.FlagTranslation.Module, lesson.FlagTranslation.Section)
			}
			//uploadedLessonID = lesson.Lesson.ID
		})

		t.Run("TestDeleteUserAsThemselves", func(t *testing.T) {
			req, err := http.NewRequest("DELETE", "http://localhost:6767/api/users/"+secondAverageUserID.String(), nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}
			req.Header.Set("Authorization", "Bearer "+secondAverageToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}
		})

		t.Run("TestGetUsersAfterDeletions", func(t *testing.T) {
			req, err := http.NewRequest("GET", "http://localhost:6767/api/users", nil)
			if err != nil {
				t.Fatal("Error creating request: ", err)
			}

			req.Header.Set("Authorization", "Bearer "+adminToken)

			resp, err := client.Do(req)
			if err != nil {
				t.Fatal("Error making request: ", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
			}

			var users []database.User
			err = json.NewDecoder(resp.Body).Decode(&users)
			if err != nil {
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
		if cfg.websiteState == "production" {
			t.Log("Skipping reset test in production environment")
			return
		}

		req, err := http.NewRequest("POST", "http://localhost:6767/admin/reset", bytes.NewReader([]byte("")))
		if err != nil {
			t.Fatal("Error creating request: ", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+adminToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatal("Error making request: ", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
		}
	})
}
