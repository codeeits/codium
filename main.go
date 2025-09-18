package main

import (
	"net/http"
)

type ApiCfg struct {
}

func main() {
	print("Hello World")

	mux := http.NewServeMux()
	mux.Handle("/app/", http.StripPrefix("/app/", http.FileServer(http.Dir("./App/"))))

	server := &http.Server{
		Addr:    ":6767",
		Handler: mux,
	}

	err := server.ListenAndServe()
	if err != nil {
		panic(err)
	}
}
