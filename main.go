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
	logger               log.Logger
	dbUrl                string
	db                   *database.Queries
	dbLoaded             bool
	secret               string
	adminDefaultPassword string
	running              bool
	smtpUrl              string
	smtpPort             int
	smtpUser             string
	smtpPassword         string
	websiteUrl           string
	websiteState         string
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
			logger:   *log.New(logFile, "[API] ", log.LstdFlags),
			dbLoaded: false,
			running:  true,
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
	}

	if cfg.secret == "" {
		cfg.logger.Fatal("A required security variable is not present!\nSet the SECRET variable as a long, random string in the .env file.")
	}

	if cfg.dbUrl != "" {
		cfg.logger.Print("Using Database URL: " + cfg.dbUrl)
		db, err := sql.Open("postgres", cfg.dbUrl)
		if err != nil {
			cfg.logger.Fatal("Error connecting to the database: ", err)
		}

		err = db.Ping()
		if err != nil {
			cfg.logger.Fatal("Error pinging the database: ", err)
		}

		cfg.db = database.New(db)
		cfg.dbLoaded = true
		cfg.logger.Print("Successfully connected to the database!")
	} else {
		cfg.logger.Print("No Database URL provided- skipping database connection.")
	}
	// test
	// Serve static files from the "App" directory at the "/app/" URL path
	{
		mux := http.NewServeMux()
		mux.Handle("/app/", http.StripPrefix("/app/", http.FileServer(http.Dir("./App/"))))
		mux.Handle("POST /api/create_user", http.HandlerFunc(cfg.CreateUserHandler))
		mux.Handle("POST /admin/reset", http.HandlerFunc(cfg.ResetHandler))
		mux.Handle("POST /api/login", http.HandlerFunc(cfg.LoginHandler))
		mux.Handle("POST /api/refresh", http.HandlerFunc(cfg.RefreshHandler))
		mux.Handle("GET /api/users", http.HandlerFunc(cfg.GetUsersHandler))
		mux.Handle("GET /api/users/{searchArg}", http.HandlerFunc(cfg.GetUserHandler))
		mux.Handle("POST /api/upload", http.HandlerFunc(cfg.UploadHandler))
		mux.Handle("GET /api/files/{fileID}", http.HandlerFunc(cfg.GetFileHandler))
		mux.Handle("PUT /api/users", http.HandlerFunc(cfg.UpdateUserDisambiguationHandler))
		mux.Handle("GET /api/email/{userID}", http.HandlerFunc(cfg.ValidateEmailHandler))
		mux.Handle("DELETE /api/users/{userID}", http.HandlerFunc(cfg.DeleteUserHandler))
		mux.Handle("POST /api/lessons", http.HandlerFunc(cfg.AddLessonHandler))
		mux.Handle("GET /api/lessons", http.HandlerFunc(cfg.GetLessonDisambiguationHandler))
		mux.Handle("DELETE /api/lessons/{lessonID}", http.HandlerFunc(cfg.DeleteLessonHandler))
		mux.Handle("POST /api/lessons/{lessonID}/favorite", http.HandlerFunc(cfg.FavoriteLessonHandler))
		mux.Handle("GET /api/lessons/{lessonID}/users/{userID}", http.HandlerFunc(cfg.GetLessonUserByLessonAndUserHandler))
		mux.Handle("POST /api/lessons/{lessonID}/bookmark", http.HandlerFunc(cfg.BookmarkLessonHandler))
		mux.Handle("GET /api/users/{userID}/bookmarks", http.HandlerFunc(cfg.GetUserBookmarksHandler))
		mux.Handle("POST /api/lessons/{lessonID}/complete", http.HandlerFunc(cfg.CompleteLessonHandler))
		mux.Handle("POST /api/lessons/{lessonID}/start", http.HandlerFunc(cfg.StartLessonHandler))
		mux.Handle("GET /api/lessons/{lessonID}/faves", http.HandlerFunc(cfg.GetFavoritesForLessonHandler))
		mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, "/app/", http.StatusMovedPermanently)
		}))

		// Start the HTTP server
		server := &http.Server{
			Addr:    ":8443",
			Handler: mux,
		}

		cfg.StartCLI()
		go func() {
			err := http.ListenAndServe(":8080", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				target := "https://" + r.Host + r.URL.RequestURI()
				http.Redirect(w, r, target, http.StatusMovedPermanently)
			}))
			if err != nil {
				panic(err)
			}
		}()
		err = server.ListenAndServeTLS("./certs/cert.pem", "./certs/key.pem")
		if err != nil {
			cfg.logger.Fatal(err)
		}
	}
}
