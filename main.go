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
	logger   log.Logger
	dbUrl    string
	db       *database.Queries
	dbLoaded bool
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
		}
		cfg.logger.Print("Hewwo World! :333")
	}

	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		cfg.logger.Print("Warning! Error loading .env file- without it you will not be able to connect to the database or any other external services!")
		cfg.logger.Print("If you run into issues, please make sure you have a .env file in the root directory with the correct variables.")

		cfg.dbUrl = ""
	} else {
		cfg.dbUrl = os.Getenv("DB_URL")
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

	// Serve static files from the "App" directory at the "/app/" URL path
	{
		mux := http.NewServeMux()
		mux.Handle("/app/", http.StripPrefix("/app/", http.FileServer(http.Dir("./App/"))))
		mux.Handle("POST /api/create_user", http.HandlerFunc(cfg.CreateUserHandler))

		server := &http.Server{
			Addr:    ":6767",
			Handler: mux,
		}

		err = server.ListenAndServe()
		if err != nil {
			cfg.logger.Fatal(err)
		}
	}
}
