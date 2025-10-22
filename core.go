package main

import (
	"Codium/internal/auth"
	"Codium/internal/database"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	Definitions

===========================================
*/

type FlagTranslation struct {
	Class   int `json:"class"`
	Section int `json:"section"`
	Number  int `json:"number"`
	Module  int `json:"module"`
}

type LessonWithFlags struct {
	Lesson          database.Lesson `json:"lesson"`
	FlagTranslation FlagTranslation `json:"flag_translation"`
}

type FlagMasks uint32

const (
	ModuleMask  FlagMasks = 0xFF000000
	NumberMask  FlagMasks = 0x00FF0000
	SectionMask FlagMasks = 0x0000FF00
	ClassMask   FlagMasks = 0x000000FF
)

/*
===========================================

	Core functions

===========================================
*/

// ResetAll Reset the database and uploaded files
func (cfg *ApiCfg) ResetAll() error {

	cfg.logger.Println("Resetting the database...")

	/*
		The old approach of deleting users is deprecated
		err := cfg.db.DeleteUsers(context.Background())
		if err != nil {
			cfg.logger.Printf("Failed to delete users: %v", err)
			return err
		}
	*/

	// Retrieve all users
	users, err := cfg.db.GetUsers(context.Background(), database.GetUsersParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve users: %v", err)
		return err
	}
	// Delete each user individually, deleting their associated data
	for _, user := range users {
		err = cfg.DeleteUser(user.ID)
	}

	cfg.logger.Println("All users deleted.")
	// Reset the uploaded images
	_, err = os.Stat("App/Images/uploads")
	if !os.IsNotExist(err) {
		err = os.RemoveAll("App/Images/uploads")
		if err != nil {
			cfg.logger.Printf("Failed to delete uploaded images: %v", err)
			return err
		}
		cfg.logger.Println("All uploaded images deleted.")
	}

	err = os.MkdirAll("App/Images/uploads", os.ModePerm)
	if err != nil {
		cfg.logger.Printf("Failed to recreate uploads directory: %v", err)
		return err
	}
	cfg.logger.Println("Uploads directory recreated.")

	// Add default admin user
	hashedPassword, err := auth.HashPassword(cfg.adminDefaultPassword)
	if err != nil {
		cfg.logger.Printf("Failed to hash default admin password: %v", err)
		return err
	}

	_, err = cfg.db.CreateUser(context.Background(), database.CreateUserParams{
		ID:           uuid.New(),
		Email:        "codiumOfficial@lekas.tech",
		PasswordHash: hashedPassword,
		Username:     "codiumOfficial",
		CreatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		IsAdmin:      true,
	})
	if err != nil {
		cfg.logger.Printf("Failed to create default admin user: %v", err)
		return err
	}

	cfg.logger.Print("Default admin user created successfully.")
	return nil
}

// Upload local upload
func (cfg *ApiCfg) Upload(multipart multipart.File, location string, fileType string, user database.User, fileExtensions string, fileSize int64) (string, string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", "", fmt.Errorf("failed to get current working directory: %v", err)
	}

	appDir := cwd + "/App/"
	location = strings.TrimSpace(location)

	var filePath string
	fileId := uuid.New()

	switch location {
	case "images":
		if strings.HasPrefix(fileType, "image/") == false {
			return "", "", fmt.Errorf("invalid file type for images: %v", fileType)
		}
		imageDir := appDir + "Images/uploads"
		// Ensure the directory exists
		err := os.MkdirAll(imageDir, os.ModePerm)
		if err != nil {
			return "", "", fmt.Errorf("failed to create image directory: %v", err)
		}
		// Handle image upload
		filePath = fmt.Sprintf("%s/%s.%s", imageDir, fileId.String(), fileExtensions)
		dst, err := os.Create(filePath)
		if err != nil {
			return "", "", fmt.Errorf("failed to create file: %v", err)
		}
		defer func(dst *os.File) {
			err := dst.Close()
			if err != nil {
				cfg.logger.Printf("Error closing the file: %v", err)
			}
		}(dst)

		//copy the uploaded file to the destination file
		_, err = io.Copy(dst, multipart)
		if err != nil {
			return "", "", fmt.Errorf("failed to save file: %v", err)
		}
		cfg.logger.Printf("Image uploaded successfully: %s", filePath)
		// Return the file path or URL
		filePath = strings.TrimPrefix(filePath, cwd+"/")
		cfg.logger.Printf("Image accessible at path: %s", filePath)

	case "lessons":
		// Check if file is markdown
		if strings.HasPrefix(fileType, "text/") == false {
			return "", "", fmt.Errorf("invalid file type for lessons: %v", fileType)
		}
		if fileExtensions != "md" && fileExtensions != "txt" {
			return "", "", fmt.Errorf("invalid file extension for lessons: %v", fileExtensions)
		}
		// Lessons are privileged uploads only
		if !user.IsAdmin {
			return "", "", fmt.Errorf("unauthorized upload attempt to lessons")
		}

		// Handle lesson upload
		lessonDir := appDir + "Lessons"
		// Ensure the directory exists
		err := os.MkdirAll(lessonDir, os.ModePerm)
		if err != nil {
			return "", "", fmt.Errorf("failed to create lessons directory: %v", err)
		}
		filePath = fmt.Sprintf("%s/%s.%s", lessonDir, fileId.String(), fileExtensions)

		dst, err := os.Create(filePath)
		if err != nil {
			return "", "", fmt.Errorf("failed to create file: %v", err)
		}
		defer func(dst *os.File) {
			err := dst.Close()
			if err != nil {
				cfg.logger.Printf("Error closing the file: %v", err)
			}
		}(dst)
		//copy the uploaded file to the destination file
		_, err = io.Copy(dst, multipart)
		if err != nil {
			return "", "", fmt.Errorf("failed to save file: %v", err)
		}
		cfg.logger.Printf("Lesson uploaded successfully: %s", filePath)
		// Return the file path or URL
		filePath = strings.TrimPrefix(filePath, cwd+"/")
		cfg.logger.Printf("Lesson accessible at path: %s", filePath)

	default:
		return "", "", fmt.Errorf("invalid location: %v", location)
	}

	_, err = cfg.db.CreateFile(context.Background(), database.CreateFileParams{
		ID:       fileId,
		UserID:   user.ID,
		Filename: fileId.String() + "." + fileExtensions,
		Filepath: filePath,
		Filesize: fileSize,
		UploadedAt: sql.NullTime{
			Time:  time.Now(),
			Valid: true,
		},
	})

	if err != nil {
		return "", "", fmt.Errorf("failed to record file in database: %v", err)
	}

	return filePath, fileId.String(), nil
}

// DeleteUser Delete a user and all their associated files
func (cfg *ApiCfg) DeleteUser(userID uuid.UUID) error {
	uploadedFiles, err := cfg.db.GetFilesByUserID(context.Background(), database.GetFilesByUserIDParams{
		UserID: userID,
		Limit:  2000,
		Offset: 0,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("No files found for user: %v", userID)
		}
		return fmt.Errorf("failed to retrieve user files: %v", err)
	}

	cwd, err := os.Getwd()
	if err != nil {
		cfg.logger.Printf("Failed to get current working directory: %v", err)
		return fmt.Errorf("failed to get current working directory: %v", err)
	}

	// Delete files from filesystem
	for _, file := range uploadedFiles {
		cfg.logger.Printf("Deleting file: %v/%v", cwd, file.Filepath)
		err = os.Remove(cwd + "/" + file.Filepath)
		if err != nil {
			cfg.logger.Printf("Failed to delete file from filesystem: %v", err)
			return fmt.Errorf("failed to delete file from filesystem: %v", err)
		}
	}

	err = cfg.db.DeleteUserById(context.Background(), userID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %v", err)
	}
	return nil
}

// ListUsers List all users without password hashes
func (cfg *ApiCfg) ListUsers() ([]database.User, error) {
	users, err := cfg.db.GetUsers(context.Background(), database.GetUsersParams{
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %v", err)
	}
	for i := range users {
		users[i].PasswordHash = "" // Remove password hash for security
	}
	return users, nil
}

// ListLessons List all lessons
func (cfg *ApiCfg) ListLessons() ([]database.Lesson, error) {
	lessons, err := cfg.db.GetLessons(context.Background(), database.GetLessonsParams{
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list lessons: %v", err)
	}

	var result []database.Lesson
	for _, lesson := range lessons {
		result = append(result, lesson)
	}
	return result, nil
}

func (cfg *ApiCfg) ListFiles() ([]database.File, error) {
	files, err := cfg.db.GetFiles(context.Background(), database.GetFilesParams{
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list files: %v", err)
	}

	var result []database.File
	for _, file := range files {
		result = append(result, file)
	}
	return result, nil
}

// ParseLessonFlags Parse the given lesson flags and return respective class, section, module and number
func ParseLessonFlags(flags int32) FlagTranslation {
	// e.g. flags = 0x01020304 -> class=4, section=3, number=2, module=1
	var class, section, number, module int
	u := uint32(flags)
	module = int(u >> 24)
	number = int((u >> 16) & 0xFF)
	section = int((u >> 8) & 0xFF)
	class = int(u & 0xFF)
	return FlagTranslation{class, section, number, module}
}

// BuildLessonFlags Build the lesson flags from class, section, module and number represented as int32 and return a mask representing the built flags
// e.g. class=4, section=3, number=2, module=1 -> flags = 0x01020304
func BuildLessonFlags(class int, section int, number int, module int) (uint32, uint32) {
	var flags uint32
	flags |= uint32(module) << 24
	flags |= uint32(number) << 16
	flags |= uint32(section) << 8
	flags |= uint32(class)

	var mask uint32 = 0
	if class > 0 {
		mask |= uint32(ClassMask)
	}
	if section > 0 {
		mask |= uint32(SectionMask)
	}
	if number > 0 {
		mask |= uint32(NumberMask)
	}
	if module > 0 {
		mask |= uint32(ModuleMask)
	}

	return flags, mask
}
