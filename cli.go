package main

import (
	"Codium/internal/CLI"
	"bufio"
	"fmt"
	"os"

	"github.com/google/uuid"
)

func (cfg *ApiCfg) StartCLI() {
	commandsCfg := CLI.NewConsoleCfg(&cfg.logger)

	// Registering Commands
	{
		cfg.logger.Print("Registering Commands")

		commandsCfg.RegisterCommand("reset", func(args []string) error {
			fmt.Println("ARE YOU SURE YOU WANT TO RESET?!?!?!? | YES / NO")
			reader := bufio.NewReader(os.Stdin)
			res, err := reader.ReadString('\n')

			if err != nil {
				return err
			}
			if res != "YES\n" {
				fmt.Println("DATABASE RESET CANCELLED")
			}
			cfg.logger.Print("Received reset command via console")
			fmt.Println("Resetting database...")
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}
			err = cfg.ResetAll()
			if err != nil {
				return err
			}
			return nil
		})
		commandsCfg.RegisterCommand("delete_user", func(args []string) error {
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
		commandsCfg.RegisterCommand("list_users", func(args []string) error {
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
				fmt.Printf(" - ID: %s, Email: %s, CreatedAt: %v\n", user.ID, user.Email, user.CreatedAt)
			}
			return nil
		})
		commandsCfg.RegisterCommand("parse_lesson_flags", func(args []string) error {
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
		commandsCfg.RegisterCommand("list_lessons", func(args []string) error {
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
				fmt.Printf(" - ID: %s, Title: %s, Author: %v, File: %v, Flags: [ Class: %v, Section: %v, Number: %v, Module: %v ]\n", lesson.ID, lesson.Title, lesson.AuthorID, lesson.ContentID, parsedFlags.Class, parsedFlags.Section, parsedFlags.Number, parsedFlags.Module)
			}
			return nil
		})
		commandsCfg.RegisterCommand("list_files", func(args []string) error {
			cfg.logger.Print("Received list_files command via console")
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}
			files, err := cfg.ListFiles()
			if err != nil {
				return err
			}
			fmt.Println("Files:")
			for _, file := range files {
				fmt.Printf(" - ID: %s, Filename: %s, FilePath: %v, Uploader: %v, UploadedAt: %v\n", file.ID, file.Filename, file.Filepath, file.UserID, file.UploadedAt)
			}
			return nil
		})
		commandsCfg.RegisterCommand("delete_file", func(args []string) error {
			if len(args) < 1 {
				return fmt.Errorf("usage: delete_file <file_id>")
			}

			fileIdStr := args[0]
			cfg.logger.Printf("Received delete_file command via console for file ID %s", fileIdStr)
			fmt.Printf("Deleting file with ID %s...\n", fileIdStr)
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}

			fileId, err := uuid.Parse(fileIdStr)
			if err != nil {
				return fmt.Errorf("invalid file ID format")
			}

			err = cfg.DeleteFile(fileId)
			if err != nil {
				return err
			}
			fmt.Println("File deleted successfully.")
			return nil
		})
		commandsCfg.RegisterCommand("delete_lesson", func(args []string) error {
			if len(args) < 1 {
				return fmt.Errorf("usage: delete_lesson <lesson_id>")
			}

			lessonIdStr := args[0]
			cfg.logger.Printf("Received delete_lesson command via console for lesson ID %s", lessonIdStr)
			fmt.Printf("Deleting lesson with ID %s...\n", lessonIdStr)
			if !cfg.dbLoaded {
				return fmt.Errorf("database not connected")
			}

			lessonId, err := uuid.Parse(lessonIdStr)
			if err != nil {
				return fmt.Errorf("invalid lesson ID format")
			}

			err = cfg.DeleteLesson(lessonId)
			if err != nil {
				return err
			}
			fmt.Println("Lesson deleted successfully.")
			return nil
		})
	}

	commandsCfg.StartConsole()
}
