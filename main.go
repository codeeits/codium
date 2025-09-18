package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
)

type ApiCfg struct {
	logger log.Logger
}

/*
===========================================

	Entry Point

===========================================
*/
func main() {
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

	apiCfg := &ApiCfg{
		logger: *log.New(logFile, "[API] ", log.LstdFlags),
	}
	apiCfg.logger.Print("Hewwo World! :333")

	mux := http.NewServeMux()
	mux.Handle("/app/", http.StripPrefix("/app/", http.FileServer(http.Dir("./App/"))))

	server := &http.Server{
		Addr:    ":6767",
		Handler: mux,
	}

	err = server.ListenAndServe()
	if err != nil {
		apiCfg.logger.Fatal(err)
	}
}
