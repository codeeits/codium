package CLI

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
)

type ConsoleCfg struct {
	Logger   *log.Logger
	Running  bool
	Commands map[string]func([]string) error
}

func (cfg *ConsoleCfg) RegisterCommand(command string, commandFunc func([]string) error) {
	cfg.Logger.Printf("\t|--\tRegistering command %s", command)
	cfg.Commands[command] = commandFunc
}

func NewConsoleCfg(logger *log.Logger) *ConsoleCfg {
	return &ConsoleCfg{
		Logger:   logger,
		Running:  true,
		Commands: make(map[string]func([]string) error),
	}
}

func (cfg *ConsoleCfg) StartConsole() {
	// Console mode for imputing Commands
	cfg.Logger.Print("Starting console...")
	fmt.Println("Starting console...")

	cfg.RegisterCommand("help", func(args []string) error {
		fmt.Println("Available Commands:")
		for cmd := range cfg.Commands {
			fmt.Println(" -", cmd)
		}
		return nil
	})

	go func() {
		reader := bufio.NewReader(os.Stdin)
		for cfg.Running {
			fmt.Print(">> ")
			line, err := reader.ReadString('\n')
			if err != nil {
				fmt.Println("Error reading command:", err)
				continue
			}
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			args := strings.Split(line, " ")

			if cmdFunc, exists := cfg.Commands[args[0]]; exists {
				err := cmdFunc(args[1:])
				if err != nil {
					fmt.Println("Error executing command:", err)
				}
			} else {
				fmt.Println("Unknown command:", args)
				err := cfg.Commands["help"](nil)
				if err != nil {
					continue
				}
			}
		}
		os.Exit(0)
	}()
}
