package main

import (
	"Codium/internal/database"
	"database/sql"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type ApiCfg struct {
	logger       log.Logger
	db           *database.Queries
	secret       string
	running      bool
	websiteUrl   string
	websiteState string
	adminCfg     struct {
		Username string
		Password string
		Token    string
	}
	smtpCfg struct {
		Url      string
		Port     int
		User     string
		Password string
	}
	databaseCfg struct {
		Url    string
		Loaded bool
	}
}

/*
===========================================

	Entry Point

===========================================
*/
func main() {
	// Initialize logger
	var cfg *ApiCfg
	{
		cwd, err := os.Getwd()
		if err != nil {
			panic(err)
		}

		loggerPath := filepath.Join(cwd, "out", "logs", "api.log")
		err = os.MkdirAll(filepath.Dir(loggerPath), 0755)
		if err != nil {
			panic(err)
		}

		logFile, err := os.OpenFile(loggerPath, os.O_CREATE|os.O_RDWR, 0666)
		if err != nil {
			panic(err)
		}

		cfg = &ApiCfg{
			logger: *log.New(logFile, "[API] ", log.LstdFlags),
			databaseCfg: struct {
				Url    string
				Loaded bool
			}{Loaded: false},
			running: true,
		}

		// Clear the file on startup
		err = logFile.Truncate(0)
		if err != nil {
			panic(err)
		}

		cfg.logger.Print("Hewwo World! :333")
	}

	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		cfg.logger.Fatal("Error loading .env file: ", err)
	}

	cfg.databaseCfg.Url = os.Getenv("DB_URL")
	cfg.secret = os.Getenv("SECRET")
	cfg.adminCfg.Password = os.Getenv("ADMIN_DEFAULT_PASSWORD")
	cfg.adminCfg.Username = "CodiumAdmin"
	cfg.smtpCfg.Url = os.Getenv("SMTP_URL")
	cfg.smtpCfg.Port = 587 // Default SMTP port
	cfg.smtpCfg.User = os.Getenv("SMTP_USER")
	cfg.smtpCfg.Password = os.Getenv("SMTP_PASSWORD")
	cfg.websiteUrl = os.Getenv("WEBSITE_URL")
	cfg.websiteState = os.Getenv("WEBSITE_STATE")

	if cfg.secret == "" {
		cfg.logger.Fatal("A required security variable is not present!\nSet the SECRET variable as a long, random string in the .env file.")
	}

	if cfg.databaseCfg.Url != "" {
		cfg.logger.Print("Using Database URL: " + cfg.databaseCfg.Url)
		db, err := sql.Open("postgres", cfg.databaseCfg.Url)
		if err != nil {
			cfg.logger.Fatal("Error connecting to the database: ", err)
		}

		err = db.Ping()
		if err != nil {
			cfg.logger.Fatal("Error pinging the database: ", err)
		}

		cfg.db = database.New(db)
		cfg.databaseCfg.Loaded = true
		cfg.logger.Print("Successfully connected to the database!")
	} else {
		cfg.logger.Print("No Database URL provided- skipping database connection.")
	}
	// test
	// Serve static files from the "App" directory at the "/app/" URL path
	{
		mux := http.NewServeMux()
		mux.Handle("/app/", http.StripPrefix("/app/", http.FileServer(http.Dir("./App/"))))

		mux.Handle("PUT /api/users", cfg.AuthenticatedEndpointMiddleware(cfg.UpdateUserDisambiguationHandler))
		mux.Handle("PUT /api/lessons/{lessonID}", cfg.AuthenticatedEndpointMiddleware(cfg.UpdateLessonDisambiguationHandler))
		mux.Handle("PUT /api/tests/{testID}", cfg.AuthenticatedEndpointMiddleware(cfg.UpdateProblemTestDisambiguationHandler))
		mux.Handle("PUT /api/problems/{problemID}", cfg.AuthenticatedEndpointMiddleware(cfg.UpdateProblemDisambiguationHandler))
		mux.Handle("PUT /api/solutions/{solutionID}", cfg.AuthenticatedEndpointMiddleware(cfg.UpdateSolutionDisambiguationHandler))

		mux.Handle("POST /admin/reset", cfg.AuthenticatedEndpointMiddleware(cfg.ResetHandler))
		mux.Handle("POST /admin/users/account_status", cfg.AuthenticatedEndpointMiddleware(cfg.SetUserAccountStatusHandler))

		// Deprecated endpoint for user creation
		mux.Handle("POST /api/create_user", http.HandlerFunc(cfg.CreateUserHandler))

		mux.Handle("POST /api/users", http.HandlerFunc(cfg.CreateUserHandler))
		mux.Handle("DELETE /api/users/{userID}", cfg.AuthenticatedEndpointMiddleware(cfg.DeleteUserHandler))
		mux.Handle("POST /api/login", http.HandlerFunc(cfg.LoginHandler))
		mux.Handle("POST /api/refresh", http.HandlerFunc(cfg.RefreshHandler))
		mux.Handle("GET /api/users", http.HandlerFunc(cfg.GetUsersHandler))
		mux.Handle("GET /api/users/{searchArg}", http.HandlerFunc(cfg.GetUserHandler))
		mux.Handle("GET /api/email/{userID}", http.HandlerFunc(cfg.ValidateEmailHandler))

		mux.Handle("POST /api/upload", cfg.AuthenticatedEndpointMiddleware(cfg.UploadHandler))
		mux.Handle("GET /api/files/{fileID}", http.HandlerFunc(cfg.GetFileHandler))

		mux.Handle("POST /api/lessons", cfg.AuthenticatedEndpointMiddleware(cfg.CreateLessonHandler))
		mux.Handle("DELETE /api/lessons/{lessonID}", cfg.AuthenticatedEndpointMiddleware(cfg.DeleteLessonHandler))
		mux.Handle("GET /api/lessons", http.HandlerFunc(cfg.GetLessonDisambiguationHandler))

		mux.Handle("POST /api/lessons/{lessonID}/favorite", cfg.AuthenticatedEndpointMiddleware(cfg.FavoriteLessonHandler))
		mux.Handle("POST /api/lessons/{lessonID}/bookmark", cfg.AuthenticatedEndpointMiddleware(cfg.BookmarkLessonHandler))
		mux.Handle("POST /api/lessons/{lessonID}/complete", cfg.AuthenticatedEndpointMiddleware(cfg.CompleteLessonHandler))
		mux.Handle("POST /api/lessons/{lessonID}/start", cfg.AuthenticatedEndpointMiddleware(cfg.StartLessonHandler))
		mux.Handle("GET /api/lessons/{lessonID}/users/{userID}", http.HandlerFunc(cfg.GetLessonUserByLessonAndUserHandler))
		// Deprecated endpoint for bookmarks
		mux.Handle("GET /api/users/{userID}/bookmarks", http.HandlerFunc(cfg.GetUserBookmarksHandler))

		mux.Handle("GET /api/users/{userID}/bookmarked_lessons", http.HandlerFunc(cfg.GetUserBookmarksHandler))
		mux.Handle("GET /api/lessons/{lessonID}/faves", http.HandlerFunc(cfg.GetFavoritesForLessonHandler))
		mux.Handle("GET /api/users/{userID}/started_lessons", http.HandlerFunc(cfg.GetUserStartedLessonsHandler))
		mux.Handle("GET /api/users/{userID}/completed_lessons", http.HandlerFunc(cfg.GetUserCompletedLessonsHandler))
		mux.Handle("GET /api/users/{userID}/interactions", http.HandlerFunc(cfg.GetUserInteractionsHandler))

		mux.Handle("POST /api/problems", cfg.AuthenticatedEndpointMiddleware(cfg.CreateProblemHandler))
		mux.Handle("GET /api/problems", http.HandlerFunc(cfg.GetProblemsDisambiguationHandler))
		mux.Handle("DELETE /api/problems/{problemID}", cfg.AuthenticatedEndpointMiddleware(cfg.DeleteProblemHandler))

		mux.Handle("POST /api/problems/{problemID}/like", cfg.AuthenticatedEndpointMiddleware(cfg.LikeProblemHandler))
		mux.Handle("POST /api/problems/{problemID}/bookmark", cfg.AuthenticatedEndpointMiddleware(cfg.BookmarkProblemHandler))
		mux.Handle("GET /api/problems/{problemID}/users/{userID}", http.HandlerFunc(cfg.GetUserProblemByUserAndProblemHandler))
		mux.Handle("GET /api/users/{userID}/bookmarked_problems", http.HandlerFunc(cfg.GetBookmarkedProblemsHandler))
		mux.Handle("GET /api/users/{userID}/solved_problems", http.HandlerFunc(cfg.GetSolvedProblemsHandler))
		mux.Handle("GET /api/problems/{problemID}/likes", http.HandlerFunc(cfg.GetLikedProblemsHandler))

		mux.Handle("POST /api/tests", cfg.AuthenticatedEndpointMiddleware(cfg.CreateProblemTestHandler))
		mux.Handle("DELETE /api/tests/{testID}", cfg.AuthenticatedEndpointMiddleware(cfg.DeleteProblemTestHandler))
		mux.Handle("GET /api/tests/{testID}", http.HandlerFunc(cfg.GetProblemTestByIDHandler))

		mux.Handle("POST /api/solutions", cfg.AuthenticatedEndpointMiddleware(cfg.CreateSolutionHandler))
		mux.Handle("DELETE /api/solutions/{solutionID}", cfg.AuthenticatedEndpointMiddleware(cfg.DeleteSolutionHandler))
		mux.Handle("GET /api/solutions", cfg.AuthenticatedEndpointMiddleware(cfg.GetSolutionsDisambiguationHandler))

		mux.Handle("GET /api/users/{userID}/started_lessons/count", http.HandlerFunc(cfg.CountUserStartedLessonsHandler))
		mux.Handle("GET /api/users/{userID}/completed_lessons/count", http.HandlerFunc(cfg.CountUserCompletedLessonsHandler))
		mux.Handle("GET /api/users/{userID}/bookmarks/count", http.HandlerFunc(cfg.CountUserBookmarkedLessonsHandler))
		mux.Handle("GET /api/solutions/count", cfg.AuthenticatedEndpointMiddleware(cfg.CountSolutionsDisambiguationHandler))
		mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/app/", http.StatusMovedPermanently)
		}))

		// Start the HTTP server
		server := &http.Server{
			Addr:    ":8443",
			Handler: mux,
		}

		simpleServer := &http.Server{
			Addr:    ":6767",
			Handler: mux,
		}

		cfg.StartCLI()
		if cfg.websiteState == "production" {
			cfg.logger.Println("Starting server in production mode with TLS...")
			err = server.ListenAndServeTLS("./certs/cert.pem", "./certs/key.pem")
			if err != nil {
				cfg.logger.Println("Error starting server with certificates: ", err)

				cfg.logger.Println("Starting server without TLS...")

				err = simpleServer.ListenAndServe()
				if err != nil {
					cfg.logger.Fatal("Error starting server: ", err)
				}
			}
		} else {
			cfg.logger.Println("Starting server in development mode without TLS...")
			err = simpleServer.ListenAndServe()
			if err != nil {
				cfg.logger.Fatal("Error starting server: ", err)
			}
		}
	}
}
