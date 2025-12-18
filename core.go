package main

import (
	"Codium/internal/auth"
	"Codium/internal/database"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
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

type TagTranslation struct {
	Module           int `json:"module"`
	Difficulty       int `json:"difficulty"`
	SolveType        int `json:"solve_type"`
	ResultType       int `json:"result_type"`
	VerificationType int `json:"verification_type"`
	SectionType      int `json:"section"`
}

type LessonWithFlags struct {
	Lesson          database.Lesson `json:"lesson"`
	FlagTranslation FlagTranslation `json:"flag_translation"`
}

type ProblemWithTags struct {
	Problem        database.Problem `json:"problem"`
	TagTranslation TagTranslation   `json:"tag_translation"`
}

type FlagMasks uint32
type LessonTagsMask uint32

const (
	// ModuleMask Lesson flags are stored as 0xMMNNSSCC where:
	//MM = Module
	//NN = Number
	//SS = Section
	//CC = Class
	ModuleMask  FlagMasks = 0xFF000000
	ClassMask   FlagMasks = 0x00FF0000
	SectionMask FlagMasks = 0x0000FF00
	NumberMask  FlagMasks = 0x000000FF

	// ProblemModuleMask coincides with the lesson ModuleMask for problem categorization
	ProblemModuleMask LessonTagsMask = 0xFF000000
	// ProblemDifficultyMask is used to categorize problems by their difficulty level (e.g. easy, medium, hard, expert)
	ProblemDifficultyMask LessonTagsMask = 0x00F00000
	// ProblemSolveTypeMask is used to categorize problems by their solve type (e.g. multiple choice, coding, written essay, etc.)
	ProblemSolveTypeMask LessonTagsMask = 0x000F0000

	// ProblemResultTypeMask is used to categorize problems by their result type (e.g. pass/fail, scored, percentage, etc.)
	ProblemResultTypeMask LessonTagsMask = 0x0000F000
	// ProblemVerificationTypeMask is used to categorize problems by their verification type (e.g. auto-graded, peer-reviewed, instructor-reviewed, etc.)
	ProblemVerificationTypeMask LessonTagsMask = 0x00000F00

	// ProblemSectionMask is used to categorize problems by their specific section within a module (e.g. arrays, linked lists, sorting algorithms, etc.)
	ProblemSectionMask LessonTagsMask = 0x000000FF
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

	defaultAdmin, err := cfg.db.CreateUser(context.Background(), database.CreateUserParams{
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

	cfg.logger.Print("[!!!] Default admin user created successfully.")

	cwd, err := os.Getwd()
	if err != nil {
		cfg.logger.Printf("Failed to get current working directory: %v", err)
		return err
	}
	//add markdown test lesson
	testLessonContentPath := cwd + "/markdown_test_all_elements.md"
	fileContent, err := os.ReadFile(testLessonContentPath)
	if err != nil {
		cfg.logger.Printf("Failed to read test lesson content: %v", err)
		return err
	}

	lessonFileID := uuid.New()
	lessonFilePath := fmt.Sprintf("App/Lessons/%s.md", lessonFileID.String())

	err = os.WriteFile(lessonFilePath, fileContent, 0644)
	if err != nil {
		cfg.logger.Printf("Failed to write test lesson file: %v", err)
		return err
	}

	_, err = cfg.db.CreateFile(context.Background(), database.CreateFileParams{
		ID:       lessonFileID,
		UserID:   defaultAdmin.ID,
		Filename: lessonFileID.String() + ".md",
		Filepath: lessonFilePath,
		Filesize: int64(len(fileContent)),
		UploadedAt: sql.NullTime{
			Time:  time.Now(),
			Valid: true,
		},
	})
	if err != nil {
		cfg.logger.Printf("Failed to record test lesson file in database: %v", err)
		return err
	}

	flags, _ := BuildLessonFlags(67, 0, 0, 0) // No specific flags for the test lesson
	_, err = cfg.db.AddLesson(context.Background(), database.AddLessonParams{
		ID:        uuid.New(),
		Title:     "Markdown Test - All Elements",
		ContentID: lessonFileID,
		Flags:     int32(flags),
		CreatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to create test lesson in database: %v", err)
		return err
	}

	cfg.logger.Println("[!!!] Test lesson created successfully.")

	cfg.logger.Println("[!!!] Database reset completed successfully.")
	return nil
}

func (cfg *ApiCfg) ToggleLessonUserFavorite(lessonID uuid.UUID, userID uuid.UUID) (database.LessonsUser, error) {
	res, err := cfg.db.GetLessonsUsersByLessonIDAndUserID(context.Background(), database.GetLessonsUsersByLessonIDAndUserIDParams{
		LessonID: lessonID,
		UserID:   userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Interaction not initialised yet, add favorite
			res, err = cfg.db.CreateLessonsUsers(context.Background(), database.CreateLessonsUsersParams{
				LessonID:  lessonID,
				UserID:    userID,
				CreatedAt: sql.NullTime{Time: time.Now(), Valid: true},
				UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
				Favorited: false,
				ID:        uuid.New(),
			})
			if err != nil {
				return database.LessonsUser{}, fmt.Errorf("failed to add favorite: %v", err)
			}
		}
	}

	// Interaction exists, toggle favorite
	newFavoriteStatus := !res.Favorited
	res, err = cfg.db.UpdateLessonsUsersFavorited(context.Background(), database.UpdateLessonsUsersFavoritedParams{
		Favorited: newFavoriteStatus,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		LessonID:  lessonID,
		UserID:    userID,
	})
	if err != nil {
		return database.LessonsUser{}, fmt.Errorf("failed to toggle favorite: %v", err)
	}

	return res, nil
}

func (cfg *ApiCfg) ToggleLessonUserBookmark(lessonID uuid.UUID, userID uuid.UUID) (database.LessonsUser, error) {
	res, err := cfg.db.GetLessonsUsersByLessonIDAndUserID(context.Background(), database.GetLessonsUsersByLessonIDAndUserIDParams{
		LessonID: lessonID,
		UserID:   userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Interaction not initialised yet, add bookmark
			res, err = cfg.db.CreateLessonsUsers(context.Background(), database.CreateLessonsUsersParams{
				LessonID:   lessonID,
				UserID:     userID,
				CreatedAt:  sql.NullTime{Time: time.Now(), Valid: true},
				UpdatedAt:  sql.NullTime{Time: time.Now(), Valid: true},
				Bookmarked: false,
				ID:         uuid.New(),
			})
			if err != nil {
				return database.LessonsUser{}, fmt.Errorf("failed to add bookmark: %v", err)
			}
		}
	}

	// Interaction exists, toggle bookmark
	newBookmarkStatus := !res.Bookmarked
	res, err = cfg.db.UpdateLessonsUsersBookmarked(context.Background(), database.UpdateLessonsUsersBookmarkedParams{
		Bookmarked: newBookmarkStatus,
		UpdatedAt:  sql.NullTime{Time: time.Now(), Valid: true},
		LessonID:   lessonID,
		UserID:     userID,
	})
	if err != nil {
		return database.LessonsUser{}, fmt.Errorf("failed to toggle bookmark: %v", err)
	}

	return res, nil
}

func (cfg *ApiCfg) MarkLessonUserStarted(lessonID uuid.UUID, userID uuid.UUID) (database.LessonsUser, error) {
	res, err := cfg.db.GetLessonsUsersByLessonIDAndUserID(context.Background(), database.GetLessonsUsersByLessonIDAndUserIDParams{
		LessonID: lessonID,
		UserID:   userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Interaction not initialised yet, create it
			res, err = cfg.db.CreateLessonsUsers(context.Background(), database.CreateLessonsUsersParams{
				LessonID:  lessonID,
				UserID:    userID,
				CreatedAt: sql.NullTime{Time: time.Now(), Valid: true},
				UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
				StartedAt: sql.NullTime{Time: time.Now(), Valid: true},
				ID:        uuid.New(),
			})
			if err != nil {
				return database.LessonsUser{}, fmt.Errorf("failed to mark lesson as started: %v", err)
			}
		}
		return res, nil
	}
	// Interaction exists, update startedAt
	res, err = cfg.db.UpdateLessonsUsersStart(context.Background(), database.UpdateLessonsUsersStartParams{
		StartedAt: sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		LessonID:  lessonID,
		UserID:    userID,
	})
	if err != nil {
		return database.LessonsUser{}, fmt.Errorf("failed to update lesson startedAt: %v", err)
	}

	return res, nil
}

func (cfg *ApiCfg) MarkLessonUserCompleted(lessonID uuid.UUID, userID uuid.UUID) (database.LessonsUser, error) {
	res, err := cfg.db.GetLessonsUsersByLessonIDAndUserID(context.Background(), database.GetLessonsUsersByLessonIDAndUserIDParams{
		LessonID: lessonID,
		UserID:   userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Interaction not initialised yet, create it
			res, err = cfg.db.CreateLessonsUsers(context.Background(), database.CreateLessonsUsersParams{
				LessonID:    lessonID,
				UserID:      userID,
				CreatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
				UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
				CompletedAt: sql.NullTime{Time: time.Now(), Valid: true},
				ID:          uuid.New(),
			})
			if err != nil {
				return database.LessonsUser{}, fmt.Errorf("failed to mark lesson as completed: %v", err)
			}
		}
		return res, nil
	}
	// Interaction exists, update completedAt
	res, err = cfg.db.UpdateLessonsUsersComplete(context.Background(), database.UpdateLessonsUsersCompleteParams{
		CompletedAt: sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
		LessonID:    lessonID,
		UserID:      userID,
	})
	if err != nil {
		return database.LessonsUser{}, fmt.Errorf("failed to update lesson completedAt: %v", err)
	}

	return res, nil
}

func (cfg *ApiCfg) ToggleProblemUserLiked(problemID uuid.UUID, userID uuid.UUID) (database.UsersProblem, error) {
	res, err := cfg.db.GetUserProblemByUserIDAndProblemID(context.Background(), database.GetUserProblemByUserIDAndProblemIDParams{
		ProblemID: problemID,
		UserID:    userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Interaction not initialised yet, add like
			res, err = cfg.db.CreateUserProblem(context.Background(), database.CreateUserProblemParams{
				ProblemID: problemID,
				UserID:    userID,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
				Liked:     sql.NullBool{Bool: false, Valid: true},
				ID:        uuid.New(),
			})
			if err != nil {
				return database.UsersProblem{}, fmt.Errorf("failed to add like: %v", err)
			}
		} else {
			return database.UsersProblem{}, fmt.Errorf("failed to retrieve user-problem interaction: %v", err)
		}
	}

	// Interaction exists, toggle like
	newLikeStatus := !res.Liked.Bool
	res, err = cfg.db.UpdateUserProblemLike(context.Background(), database.UpdateUserProblemLikeParams{
		Liked:     sql.NullBool{Bool: newLikeStatus, Valid: true},
		UpdatedAt: time.Now(),
		ProblemID: problemID,
		UserID:    userID,
	})
	if err != nil {
		return database.UsersProblem{}, fmt.Errorf("failed to toggle like: %v", err)
	}
	return res, nil
}

func (cfg *ApiCfg) ToggleProblemUserBookmarked(problemID uuid.UUID, userID uuid.UUID) (database.UsersProblem, error) {
	res, err := cfg.db.GetUserProblemByUserIDAndProblemID(context.Background(), database.GetUserProblemByUserIDAndProblemIDParams{
		ProblemID: problemID,
		UserID:    userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Interaction not initialised yet, add bookmark
			res, err = cfg.db.CreateUserProblem(context.Background(), database.CreateUserProblemParams{
				ProblemID:  problemID,
				UserID:     userID,
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
				Bookmarked: sql.NullBool{Bool: false, Valid: true},
			})
			if err != nil {
				return database.UsersProblem{}, fmt.Errorf("failed to add bookmark: %v", err)
			}
		} else {
			return database.UsersProblem{}, fmt.Errorf("failed to retrieve user-problem interaction: %v", err)
		}
	}
	// Interaction exists, toggle bookmark
	newBookmarkStatus := !res.Bookmarked.Bool
	res, err = cfg.db.UpdateUserProblemBookmark(context.Background(), database.UpdateUserProblemBookmarkParams{
		Bookmarked: sql.NullBool{Bool: newBookmarkStatus, Valid: true},
		UpdatedAt:  time.Now(),
		ProblemID:  problemID,
		UserID:     userID,
	})
	if err != nil {
		return database.UsersProblem{}, fmt.Errorf("failed to toggle bookmark: %v", err)
	}
	return res, nil
}

func (cfg *ApiCfg) MarkProblemUserSolved(problemID uuid.UUID, userID uuid.UUID) (database.UsersProblem, error) {
	res, err := cfg.db.GetUserProblemByUserIDAndProblemID(context.Background(), database.GetUserProblemByUserIDAndProblemIDParams{
		ProblemID: problemID,
		UserID:    userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Interaction not initialised yet, create it
			res, err = cfg.db.CreateUserProblem(context.Background(), database.CreateUserProblemParams{
				ProblemID: problemID,
				UserID:    userID,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
				SolvedAt:  sql.NullTime{Time: time.Now(), Valid: true},
				ID:        uuid.New(),
			})
			if err != nil {
				return database.UsersProblem{}, fmt.Errorf("failed to mark problem as solved: %v", err)
			}
		} else {
			return database.UsersProblem{}, fmt.Errorf("failed to retrieve user-problem interaction: %v", err)
		}
	}
	// Interaction exists, check if already solved
	if res.SolvedAt.Valid {
		return res, nil // Already marked as solved
	}

	res, err = cfg.db.UpdateUserProblemSolvedAt(context.Background(), database.UpdateUserProblemSolvedAtParams{
		SolvedAt:  sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt: time.Now(),
		ProblemID: problemID,
		UserID:    userID,
	})
	if err != nil {
		return database.UsersProblem{}, fmt.Errorf("failed to update problem solvedAt: %v", err)
	}
	return res, nil
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

func (cfg *ApiCfg) DeleteLesson(lessonID uuid.UUID) error {
	lesson, err := cfg.db.GetLessonByID(context.Background(), lessonID)
	if err != nil {
		return fmt.Errorf("failed to retrieve lesson: %v", err)
	}
	err = cfg.DeleteFile(lesson.ContentID)
	if err != nil {
		return fmt.Errorf("failed to delete lesson content file: %v", err)
	}
	err = cfg.db.DeleteLessonByID(context.Background(), lessonID)
	if err != nil {
		return fmt.Errorf("failed to delete lesson: %v", err)
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

// ListFiles List all files
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
	// e.g. flags = 0x01020304 -> number=4, section=3, class=2, module=1
	var class, section, number, module int
	u := uint32(flags)
	module = int(u >> 24)
	class = int((u >> 16) & 0xFF)
	section = int((u >> 8) & 0xFF)
	number = int(u & 0xFF)
	return FlagTranslation{class, section, number, module}
}

func ParseProblemTags(tags int32) TagTranslation {
	// e.g. tags = 0x01020304 -> Section = 4, VerificationType=3, ResultType=2, SolveType=1, Difficulty=0, Module=1
	u := uint32(tags)
	module := int(u >> 24)
	difficulty := int((u >> 20) & 0x0F)
	solveType := int((u >> 16) & 0x0F)
	resultType := int((u >> 12) & 0x0F)
	verificationType := int((u >> 8) & 0x0F)
	sectionType := int(u & 0xFF)
	return TagTranslation{module, difficulty, solveType, resultType, verificationType, sectionType}
}

func (cfg *ApiCfg) DeleteFile(fileID uuid.UUID) error {
	file, err := cfg.db.GetFileByID(context.Background(), fileID)
	if err != nil {
		return fmt.Errorf("failed to retrieve file: %v", err)
	}

	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get current working directory: %v", err)
	}

	// Delete file from filesystem
	err = os.Remove(cwd + "/" + file.Filepath)
	if err != nil {
		return fmt.Errorf("failed to delete file from filesystem: %v", err)
	}

	// Delete file record from database
	err = cfg.db.DeleteFileByID(context.Background(), fileID)
	if err != nil {
		return fmt.Errorf("failed to delete file record from database: %v", err)
	}

	return nil
}

func (cfg *ApiCfg) AuthenticateUser(r *http.Request) (database.User, error) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		cfg.logger.Printf("Unauthorized access attempt: %v", err)
		return database.User{}, err
	}

	targetId, err := auth.ValidateJWT(token, cfg.secret)
	if err != nil {
		cfg.logger.Printf("Invalid token: %v", err)
		return database.User{}, err
	}
	targetUser, err := cfg.db.GetUserByID(r.Context(), targetId)
	if err != nil {
		cfg.logger.Printf("Failed to retrieve user: %v", err)
		return database.User{}, err
	}

	return targetUser, nil
}

func (cfg *ApiCfg) AuthenticatedEndpointMiddleware(next func(w http.ResponseWriter, r *http.Request, user database.User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Authenticate the user
		user, err := cfg.AuthenticateUser(r)
		if err != nil {
			http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
			return
		}
		// Call the next handler with the authenticated user
		next(w, r, user)
	}
}

// WriteSingleJsonOutput Write a single JSON object to the response
func (cfg *ApiCfg) WriteSingleJsonOutput(w http.ResponseWriter, statusCode int, data interface{}, printer func(any) (string, error)) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	jsonData, err := printer(data)
	if err != nil {
		cfg.logger.Printf("Failed to marshal problem test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(jsonData))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

// WriteListJsonOutput Write a list of JSON objects to the response
func (cfg *ApiCfg) WriteListJsonOutput(w http.ResponseWriter, statusCode int, data []any, printer func(any) (string, error)) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)

	_, err := w.Write([]byte("["))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
	for i, obj := range data {
		if i > 0 {
			_, err = w.Write([]byte(","))
			if err != nil {
				cfg.logger.Printf("Failed to write response: %v", err)
				http.Error(w, "Failed to write response", http.StatusInternalServerError)
				return
			}
		}
		dataJson, err := printer(obj)
		if err != nil {
			cfg.logger.Printf("Failed to marshal obj: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		_, err = w.Write([]byte(dataJson))
		if err != nil {
			cfg.logger.Printf("Failed to write response: %v", err)
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
			return
		}
	}
	_, err = w.Write([]byte("]"))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

// GenericPrinter Generic JSON printer for any data type
func GenericPrinter(data any) (string, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal data: %v", err)
	}
	return string(jsonData), nil
}

// PrintUserToJson Print user to JSON without password hash
func PrintUserToJson(p any) (string, error) {
	user, ok := p.(database.User)
	if !ok {
		return "", fmt.Errorf("invalid type assertion for user")
	}

	user.PasswordHash = "" // Remove password hash for security
	jsonData, err := json.Marshal(user)
	if err != nil {
		return "", fmt.Errorf("failed to marshal user: %v", err)
	}
	return string(jsonData), nil
}

// PrintLessonToJson Print lesson to JSON with parsed flags
func PrintLessonToJson(p any) (string, error) {
	lesson, ok := p.(database.Lesson)
	if !ok {
		return "", fmt.Errorf("invalid type assertion for lesson")
	}
	lessonJsonData := LessonWithFlags{
		Lesson:          lesson,
		FlagTranslation: ParseLessonFlags(lesson.Flags),
	}

	jsonData, err := json.Marshal(lessonJsonData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal lesson: %v", err)
	}
	return string(jsonData), nil

}

// PrintProblemToJson Print problem to JSON with parsed tags
func PrintProblemToJson(p any) (string, error) {
	problem, ok := p.(database.Problem)
	if !ok {
		return "", fmt.Errorf("invalid type assertion for problem")
	}

	problemJsonData := ProblemWithTags{
		Problem:        problem,
		TagTranslation: ParseProblemTags(problem.Tags),
	}
	jsonData, err := json.Marshal(problemJsonData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal problem: %v", err)
	}
	return string(jsonData), nil
}

// DecodeParamsFromBody Decode JSON parameters from request body into the specified struct type T
func DecodeParamsFromBody[T any](r *http.Request, _ T) (T, error) {
	decoder := json.NewDecoder(r.Body)
	var p T
	err := decoder.Decode(&p)
	if err != nil {
		var zero T
		return zero, fmt.Errorf("failed to decode request body: %v", err)
	}
	return p, nil
}

// BuildLessonFlags Build the lesson flags from class, section, module and number represented as int32 and return a mask representing the built flags
// e.g. class=4, section=3, number=2, module=1 -> flags = 0x01020304
func BuildLessonFlags(class int, section int, number int, module int) (flags uint32, mask uint32) {
	flags = 0
	flags |= uint32(module) << 24
	flags |= uint32(class) << 16
	flags |= uint32(section) << 8
	flags |= uint32(number)

	mask = 0
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

func BuildProblemTags(module int, difficulty int, solveType int, resultType int, verificationType int, section int) (tags uint32, mask uint32) {
	tags = 0
	tags |= uint32(module) << 24
	tags |= uint32(difficulty) << 20
	tags |= uint32(solveType) << 16
	tags |= uint32(resultType) << 12
	tags |= uint32(verificationType) << 8
	tags |= uint32(section)

	mask = 0
	if module > 0 {
		mask |= uint32(ProblemModuleMask)
	}
	if difficulty > 0 {
		mask |= uint32(ProblemDifficultyMask)
	}
	if solveType > 0 {
		mask |= uint32(ProblemSolveTypeMask)
	}
	if resultType > 0 {
		mask |= uint32(ProblemResultTypeMask)
	}
	if verificationType > 0 {
		mask |= uint32(ProblemVerificationTypeMask)
	}
	if section > 0 {
		mask |= uint32(ProblemSectionMask)
	}

	return tags, mask
}
