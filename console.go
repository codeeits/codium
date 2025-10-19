package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
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
			cfg.logger.Print("Received stop command via console")
			fmt.Println("Stopping application...")
			cfg.running = false
			return nil
		})
		cfg.RegisterCommand("reset", func(args []string) error {
			cfg.logger.Print("Received reset command via console")
			fmt.Println("Resetting database...")
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}
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
		cfg.RegisterCommand("delete_user", func(args []string) error {
			if len(args) < 1 {
				return fmt.Errorf("usage: delete_user <user_id>")
			}
			userIdStr := args[0]
			cfg.logger.Printf("Received delete_user command via console for user ID %s", userIdStr)
			fmt.Printf("Deleting user with ID %s...\n", userIdStr)
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}

			userId, err := uuid.Parse(userIdStr)
			if err != nil {
				return fmt.Errorf("invalid user ID format")
			}

			err = cfg.DeleteUser(userId)
			if err != nil {
				return err
			}
			fmt.Println("User deleted successfully.")
			return nil
		})
		cfg.RegisterCommand("list_users", func(args []string) error {
			cfg.logger.Print("Received list_users command via console")
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}
			users, err := cfg.ListUsers()
			if err != nil {
				return err
			}
			fmt.Println("Users:")
			for _, user := range users {
				fmt.Printf(" - ID: %s, Email: %s, CreatedAt: %s\n", user.ID, user.Email, user.CreatedAt)
			}
			return nil
		})
		cfg.RegisterCommand("parse_lesson_flags", func(args []string) error {
			cfg.logger.Print("Received parse_lesson_flags command via console")
			if len(args) < 1 {
				return fmt.Errorf("usage: parse_lesson_flags <flags_integer>")
			}
			flagsStr := args[0]
			var flagsInt int64
			_, err := fmt.Sscanf(flagsStr, "%d", &flagsInt)
			if err != nil {
				return fmt.Errorf("invalid flags integer format")
			}
			parsedFlag := ParseLessonFlags(int32(flagsInt))
			fmt.Printf("Parsed Lesson Flags:\n - Class: %d\n - Section: %d\n - Number: %d\n - Module: %d\n", parsedFlag.Class, parsedFlag.Section, parsedFlag.Number, parsedFlag.Module)
			return nil
		})
		cfg.RegisterCommand("list_lessons", func(args []string) error {
			cfg.logger.Print("Received list_lessons command via console")
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}
			lessons, err := cfg.ListLessons()
			if err != nil {
				return err
			}
			fmt.Println("Lessons:")
			for _, lesson := range lessons {
				parsedFlags := ParseLessonFlags(lesson.Flags)
				fmt.Printf(" - ID: %s, Title: %s, Author: %v, Flags: [ Class: %v, Section: %v, Number: %v, Module: %v ]\n", lesson.ID, lesson.Title, lesson.AuthorID, parsedFlags.Class, parsedFlags.Section, parsedFlags.Number, parsedFlags.Module)
			}
			return nil
		})
	}

	go func() {
		reader := bufio.NewReader(os.Stdin)
		for cfg.running {
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

			if cmdFunc, exists := commands[args[0]]; exists {
				err := cmdFunc(args[1:])
				if err != nil {
					fmt.Println("Error executing command:", err)
				}
			} else {
				fmt.Println("Unknown command:", args)
				err := commands["help"](nil)
				if err != nil {
					continue
				}
			}
		}
		os.Exit(0)
	}()
}
