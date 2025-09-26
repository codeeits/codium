package main

import (
	"fmt"
	"os"
	"strings"
)

var commands map[string]func([]string) error

func (cfg *ApiCfg) RegisterCommand(command string, commandFunc func([]string) error) {
	cfg.logger.Printf("\t|--\tRegistering command %s", command)
	commands[command] = commandFunc
}

func (cfg *ApiCfg) StartConsole() {
	// Console mode for imputing commands
	cfg.logger.Print("Starting console...")
	fmt.Println("Starting console...")

	// Registering commands
	{
		cfg.logger.Print("Registering commands")
		commands = make(map[string]func([]string) error)
		cfg.RegisterCommand("stop", func(args []string) error {
			cfg.logger.Print("Stopping application...")
			fmt.Println("Stopping application...")
			cfg.running = false
			return nil
		})
		cfg.RegisterCommand("reset", func(args []string) error {
			err := cfg.ResetAll()
			if err != nil {
				return err
			}
			return nil
		})
		cfg.RegisterCommand("help", func(args []string) error {
			fmt.Println("Available commands:")
			for cmd := range commands {
				fmt.Println(" -", cmd)
			}
			return nil
		})
	}

	go func() {
		for cfg.running {
			var command string
			fmt.Print(">> ")
			_, err := fmt.Scanln(&command)
			if err != nil {
				fmt.Println("Error reading command:", err)
				continue
			}

			args := strings.Split(command, " ")
			if err != nil {
				fmt.Println("Error parsing command:", err)
				continue
			}

			if cmdFunc, exists := commands[args[0]]; exists {
				err := cmdFunc(args[1:])
				if err != nil {
					fmt.Println("Error executing command:", err)
				}
			} else {
				fmt.Println("Unknown command:", command)
			}
		}
		os.Exit(0)
	}()
}
