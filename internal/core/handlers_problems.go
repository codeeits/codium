package core

import (
	"Codium/internal/database"
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	Helper Functions

===========================================
*/

func (cfg *ApiCfg) UpdateProblemTests(problemID uuid.UUID, firstTestId uuid.UUID) (database.Problem, error) {
	test, err := cfg.Db.GetCodeTestByID(context.Background(), firstTestId)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		cfg.Logger.Printf("Failed to retrieve first test: %v", err)
		return database.Problem{}, err
	}

	var cnt int32 = 0
	for test.ID != uuid.Nil {
		cnt++
		test, err = cfg.Db.GetCodeTestByID(context.Background(), test.NextTestID.UUID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Failed to retrieve test %v: %v", test.ID, err)
			return database.Problem{}, err
		}
	}

	res, err := cfg.Db.UpdateProblemFirstTest(context.Background(), database.UpdateProblemFirstTestParams{
		FirstTest:  uuid.NullUUID{UUID: firstTestId, Valid: firstTestId != uuid.Nil},
		ID:         problemID,
		UpdatedAt:  time.Now(),
		TotalTests: cnt,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update test %v: %v", problemID, err)
		return database.Problem{}, err
	}

	cfg.Logger.Printf("Updated problem %v with total test %v", problemID, res.TotalTests)
	return res, err
}

/*
===========================================

	Problem CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		Title            string    `json:"title"`
		Description      string    `json:"description"`
		Source           string    `json:"source"`
		FirstTestID      uuid.UUID `json:"first_test_id"`
		ThumbnailID      uuid.UUID `json:"thumbnail_id"`
		Difficulty       int       `json:"difficulty"`
		Module           int       `json:"module"`
		SolveType        int       `json:"solve_type"`
		ResultType       int       `json:"result_type"`
		VerificationType int       `json:"verification_type"`
		Section          int       `json:"section"`
	}
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if !(UserHasPermission(sendingUser, PermissionCanManageProblems) || UserHasPermission(sendingUser, PermissionCanSuggestProblems)) {
		cfg.Logger.Printf("Unauthorized create problem attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})

	cfg.Logger.Print("Received create problem request with body: ", p)

	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if p.Title == "" || p.Description == "" {
		cfg.Logger.Printf("Missing required fields in request body")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	tags, _ := BuildProblemTags(p.Difficulty, p.Module, p.SolveType, p.ResultType, p.VerificationType, p.Section)

	res, err := cfg.Db.CreateProblem(r.Context(), database.CreateProblemParams{
		ID:              uuid.New(),
		Title:           p.Title,
		Description:     p.Description,
		Source:          sql.NullString{String: p.Source, Valid: p.Source != ""},
		ThumbnailFileID: uuid.NullUUID{UUID: p.ThumbnailID, Valid: p.ThumbnailID != uuid.Nil},
		Tags:            int32(tags),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		AuthorID:        sendingUser.ID,
		Suggested:       UserHasPermission(sendingUser, PermissionCanSuggestProblems),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to create problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = cfg.UpdateProblemTests(res.ID, p.FirstTestID)
	if err != nil {
		cfg.Logger.Printf("Failed to update problem tests: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, PrintProblemToJson)
}

func (cfg *ApiCfg) DeleteProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received delete problem request")

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.Logger.Printf("Unauthorized delete problem attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Parse problem ID as UUID
	problem, err := GetObjByPathUUID(r, "problemID", cfg.Db.GetProblemByID)
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	err = cfg.Db.DeleteProblem(r.Context(), problem.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to delete problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) GetProblemByIDHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received get problem by ID request")

	res, err := GetObjByQueryUUID(r, "problem_id", cfg.Db.GetProblemByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Problem not found: %v", res.ID)
			http.Error(w, "Problem not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsHandler(w http.ResponseWriter, r *http.Request) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received get problems request")

	problems, err := cfg.Db.GetProblems(r.Context(), database.GetProblemsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsByTagsHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Module           int `json:"module"`
		Difficulty       int `json:"difficulty"`
		SolveType        int `json:"solve_type"`
		ResultType       int `json:"result_type"`
		VerificationType int `json:"verification_type"`
		SectionType      int `json:"section"`
	}

	var p = params{
		Module:           0,
		Difficulty:       0,
		SolveType:        0,
		ResultType:       0,
		VerificationType: 0,
		SectionType:      0,
	}

	// database check is done in the disambiguation function
	cfg.Logger.Print("Received get problems by tags request")

	q := r.URL.Query()
	if len(q) > 0 {
		moduleStr := q.Get("module")
		difficultyStr := q.Get("difficulty")
		solveTypeStr := q.Get("solve_type")
		resultTypeStr := q.Get("result_type")
		verificationTypeStr := q.Get("verification_type")
		sectionTypeStr := q.Get("section")

		if moduleStr != "" {
			p.Module, _ = strconv.Atoi(moduleStr)
		}
		if difficultyStr != "" {
			p.Difficulty, _ = strconv.Atoi(difficultyStr)
		}
		if solveTypeStr != "" {
			p.SolveType, _ = strconv.Atoi(solveTypeStr)
		}
		if resultTypeStr != "" {
			p.ResultType, _ = strconv.Atoi(resultTypeStr)
		}
		if verificationTypeStr != "" {
			p.VerificationType, _ = strconv.Atoi(verificationTypeStr)
		}
		if sectionTypeStr != "" {
			p.SectionType, _ = strconv.Atoi(sectionTypeStr)
		}
	}

	tags, mask := BuildProblemTags(p.Difficulty, p.Module, p.SolveType, p.ResultType, p.VerificationType, p.SectionType)
	problems, err := cfg.Db.GetProblemsByTag(r.Context(), database.GetProblemsByTagParams{
		Tags:   int32(mask),
		Tags_2: int32(tags),
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problems by tags: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsByAuthorHandler(w http.ResponseWriter, r *http.Request) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received get problems by author request")

	// Parse author ID as UUID
	authorID, err := GetUUIDFromQuery(r, "author_id")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for author ID: %v", err)
		http.Error(w, "Invalid author ID format", http.StatusBadRequest)
		return
	}

	problems, err := cfg.Db.GetProblemsByAuthorID(r.Context(), database.GetProblemsByAuthorIDParams{
		AuthorID: authorID,
		Limit:    1000,
		Offset:   0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problems by author: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsBySourceHandler(w http.ResponseWriter, r *http.Request) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received get problems by source request")
	source := r.URL.Query().Get("source")
	if source == "" {
		cfg.Logger.Printf("Missing source parameter in request")
		http.Error(w, "Missing source parameter", http.StatusBadRequest)
		return
	}

	problems, err := cfg.Db.GetProblemsBySource(r.Context(), database.GetProblemsBySourceParams{
		Source: sql.NullString{Valid: true, String: source},
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problems by source: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsBySearchHandler(w http.ResponseWriter, r *http.Request) {
	cfg.Logger.Print("Received get problems by search request")
	search := r.URL.Query().Get("search")
	if search == "" {
		cfg.Logger.Printf("Missing search parameter in request")
		http.Error(w, "Missing search parameter", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.GetProblemsBySearchQuery(r.Context(), database.GetProblemsBySearchQueryParams{
		Column1: sql.NullString{Valid: true, String: search},
		Limit:   30,
		Offset:  0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problems by search: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(res), PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemFirstTestHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		FirstTestID uuid.UUID `json:"first_test_id"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received update problem first test request for problem ID: ", targetProblem.ID)

	res, err := cfg.UpdateProblemTests(targetProblem.ID, p.FirstTestID)

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemThumbnailHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		ThumbnailID uuid.UUID `json:"thumbnail_id"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received update problem thumbnail request for problem ID: ", targetProblem.ID)

	res, err := cfg.Db.UpdateProblemThumbnail(r.Context(), database.UpdateProblemThumbnailParams{
		ID:              targetProblem.ID,
		ThumbnailFileID: uuid.NullUUID{UUID: p.ThumbnailID, Valid: p.ThumbnailID != uuid.Nil},
		UpdatedAt:       time.Now(),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update problem thumbnail: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemTagsHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		Difficulty       int `json:"difficulty"`
		Module           int `json:"module"`
		SolveType        int `json:"solve_type"`
		ResultType       int `json:"result_type"`
		VerificationType int `json:"verification_type"`
		SectionType      int `json:"section"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received update problem tags request for problem ID: ", targetProblem.ID)

	tags, mask := BuildProblemTags(p.Module, p.Difficulty, p.SolveType, p.ResultType, p.VerificationType, p.SectionType)

	tag := (targetProblem.Tags & ^int32(mask)) | int32(tags)

	res, err := cfg.Db.UpdateProblemTags(r.Context(), database.UpdateProblemTagsParams{
		ID:        targetProblem.ID,
		Tags:      tag,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update problem tags: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemDetailsHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Source      string `json:"source"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received update problem details request for problem ID: ", targetProblem.ID)

	if p.Title == "" || p.Description == "" {
		cfg.Logger.Printf("Missing required fields in request body")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateProblemDetails(r.Context(), database.UpdateProblemDetailsParams{
		ID:          targetProblem.ID,
		Title:       p.Title,
		Description: p.Description,
		Source:      sql.NullString{String: p.Source, Valid: p.Source != ""},
		UpdatedAt:   time.Now(),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update problem details: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) GetSuggestedProblemsHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.Logger.Printf("Unauthorized get suggested problems attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cfg.Logger.Print("Received get suggested problems request")

	problems, err := cfg.Db.GetSuggestedProblems(r.Context(), database.GetSuggestedProblemsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve suggested problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

/*
===========================================

	Problem Tests CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateProblemTestHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		InputText      string    `json:"input_text"`
		InputFile      uuid.UUID `json:"input_file"`
		ExpectedOutput string    `json:"expected_output"`
		PreviousTestID uuid.UUID `json:"previous_test_id"`
		NextTestID     uuid.UUID `json:"next_test_id"`
	}

	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received create problem test request")

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.Logger.Printf("Unauthorized create problem test attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})

	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if p.InputText == "" && p.InputFile == uuid.Nil {
		cfg.Logger.Printf("Missing input data in request body")
		http.Error(w, "Missing input data", http.StatusBadRequest)
		return
	}

	if p.ExpectedOutput == "" {
		cfg.Logger.Printf("Missing expected output in request body")
		http.Error(w, "Missing expected output", http.StatusBadRequest)
		return
	}

	var inputFile bool
	if p.InputFile != uuid.Nil {
		inputFile = true
	} else {
		inputFile = false
	}

	res, err := cfg.Db.CreateCodeTest(r.Context(), database.CreateCodeTestParams{
		ID:             uuid.New(),
		TxtInput:       sql.NullString{String: p.InputText, Valid: !inputFile},
		FileInput:      uuid.NullUUID{UUID: p.InputFile, Valid: inputFile},
		ExpectedOutput: p.ExpectedOutput,
		PreviousTestID: uuid.NullUUID{UUID: p.PreviousTestID, Valid: p.PreviousTestID != uuid.Nil},
		NextTestID:     uuid.NullUUID{UUID: p.NextTestID, Valid: p.NextTestID != uuid.Nil},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to create problem test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if p.PreviousTestID != uuid.Nil {
		_, err = cfg.Db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
			ID:         p.PreviousTestID,
			NextTestID: uuid.NullUUID{UUID: res.ID, Valid: true},
			UpdatedAt:  time.Now(),
		})

		if err != nil {
			cfg.Logger.Printf("Failed to update previous problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if p.NextTestID != uuid.Nil {
		_, err = cfg.Db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
			ID:             p.NextTestID,
			PreviousTestID: uuid.NullUUID{UUID: res.ID, Valid: true},
			UpdatedAt:      time.Now(),
		})

		if err != nil {
			cfg.Logger.Printf("Failed to update next problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, GenericPrinter)
}

func (cfg *ApiCfg) GetProblemTestByIDHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received get problem test by ID request")

	// Parse test ID as UUID
	res, err := GetObjByPathUUID(r, "testID", cfg.Db.GetCodeTestByID)
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problem test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// remove answers for students
	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		res.ExpectedOutput = ""
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) DeleteProblemTestHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received delete problem test request")

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.Logger.Printf("Unauthorized delete problem test attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Parse test ID as UUID
	test, err := GetObjByPathUUID(r, "testID", cfg.Db.GetCodeTestByID)
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format or test not found: %v", err)
		http.Error(w, "Invalid test ID format or test not found", http.StatusBadRequest)
		return
	}

	if test.NextTestID.Valid {
		_, err = cfg.Db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
			ID:             test.NextTestID.UUID,
			PreviousTestID: test.PreviousTestID,
			UpdatedAt:      time.Now(),
		})

		if err != nil {
			cfg.Logger.Printf("Failed to update next problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if test.PreviousTestID.Valid {
		_, err = cfg.Db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
			ID:         test.PreviousTestID.UUID,
			NextTestID: test.NextTestID,
			UpdatedAt:  time.Now(),
		})

		if err != nil {
			cfg.Logger.Printf("Failed to update previous problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	err = cfg.Db.DeleteCodeTestByID(r.Context(), test.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to delete problem test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) UpdateProblemTestInputHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		InputText string    `json:"input_text"`
		InputFile uuid.UUID `json:"input_file"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var inputFile bool
	if p.InputFile != uuid.Nil {
		inputFile = true
	} else {
		inputFile = false
	}

	res, err := cfg.Db.UpdateCodeTestInputs(r.Context(), database.UpdateCodeTestInputsParams{
		ID:        test.ID,
		TxtInput:  sql.NullString{String: p.InputText, Valid: !inputFile},
		FileInput: uuid.NullUUID{UUID: p.InputFile, Valid: inputFile},
	})

	if err != nil {
		cfg.Logger.Printf("Failed to update problem test inputs: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateProblemTestExpectedOutputHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		ExpectedOutput string `json:"expected_output"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateCodeTestExpectedOutput(r.Context(), database.UpdateCodeTestExpectedOutputParams{
		ID:             test.ID,
		ExpectedOutput: p.ExpectedOutput,
	})

	if err != nil {
		cfg.Logger.Printf("Failed to update problem test expected output: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateProblemTestNextHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		NextTestID uuid.UUID `json:"next"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	//Update the old next test's previous ID to null if it exists
	if test.NextTestID.Valid {
		_, err = cfg.Db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
			ID:             test.NextTestID.UUID,
			PreviousTestID: uuid.NullUUID{UUID: uuid.Nil, Valid: false},
			UpdatedAt:      time.Now(),
		})

		if err != nil {
			cfg.Logger.Printf("Failed to update old next problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.Db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
		ID:         test.ID,
		NextTestID: uuid.NullUUID{UUID: p.NextTestID, Valid: p.NextTestID != uuid.Nil},
		UpdatedAt:  time.Now(),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update problem test next ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateProblemTestPreviousHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		PreviousTestID uuid.UUID `json:"prev"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	//Update the old previous test's next ID to null if it exists
	if test.PreviousTestID.Valid {
		_, err = cfg.Db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
			ID:         test.PreviousTestID.UUID,
			NextTestID: uuid.NullUUID{UUID: uuid.Nil, Valid: false},
			UpdatedAt:  time.Now(),
		})

		if err != nil {
			cfg.Logger.Printf("Failed to update old previous problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.Db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
		ID:             test.ID,
		PreviousTestID: uuid.NullUUID{UUID: p.PreviousTestID, Valid: p.PreviousTestID != uuid.Nil},
		UpdatedAt:      time.Now(),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update problem test previous ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}
