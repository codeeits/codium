package core

import (
	"Codium/internal/database"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	Users Problems CRUD

===========================================
*/

func (cfg *ApiCfg) GetUserProblemByUserAndProblemHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received get user problems request")

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	userProblem, err := cfg.Db.GetUserProblemByUserIDAndProblemID(r.Context(), database.GetUserProblemByUserIDAndProblemIDParams{
		UserID:    userID,
		ProblemID: problemID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("User problem not found for user ID: %v and problem ID: %v", userID, problemID)
			http.Error(w, "User problem not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve user problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, userProblem, GenericPrinter)
}

func (cfg *ApiCfg) LikeProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received like problem request for problem ID: %v by user ID: %v", problemID, sendingUser.ID)

	res, err := cfg.ToggleProblemUserLiked(problemID, sendingUser.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to toggle problem like status: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) BookmarkProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received bookmark problem request for problem ID: %v by user ID: %v", problemID, sendingUser.ID)

	res, err := cfg.ToggleProblemUserBookmarked(problemID, sendingUser.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to toggle problem bookmark status: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) GetBookmarkedProblemsHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received get bookmarked problems request for user ID: ", userID)
	userProblems, err := cfg.Db.GetBookmarkedProblemsByUserID(r.Context(), database.GetBookmarkedProblemsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve bookmarked problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, userProblemsToAny(userProblems), GenericPrinter)
}

func (cfg *ApiCfg) GetLikedProblemsHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received get liked problems request")
	userProblems, err := cfg.Db.GetProblemLikesByProblemID(r.Context(), database.GetProblemLikesByProblemIDParams{
		ProblemID: problemID,
		Limit:     1000,
		Offset:    0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve liked problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, userProblemsToAny(userProblems), GenericPrinter)
}

func (cfg *ApiCfg) GetSolvedProblemsHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received get solved problems request")
	userProblems, err := cfg.Db.GetSolvedProblemsByUserID(r.Context(), database.GetSolvedProblemsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve solved problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, userProblemsToAny(userProblems), GenericPrinter)
}

/*
===========================================

	Solutions CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateSolutionHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		ProblemID uuid.UUID `json:"problem_id"`
		Code      string    `json:"code"`
		Language  string    `json:"language"`
	}

	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received create solution request")

	if sendingUser.EmailValidated == false && cfg.WebsiteState == "production" {
		cfg.Logger.Printf("User email not validated: %v", sendingUser.ID)
		http.Error(w, "Email not validated", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})

	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if p.ProblemID == uuid.Nil || p.Code == "" || p.Language == "" {
		cfg.Logger.Printf("Missing required fields in request body")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	problem, err := cfg.Db.GetProblemByID(r.Context(), p.ProblemID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Problem not found: %v", p.ProblemID)
			http.Error(w, "Problem not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	test, err := cfg.Db.GetCodeTestByID(r.Context(), problem.FirstTest.UUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Problem not found: %v", problem.FirstTest.UUID)
			http.Error(w, "Problem not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var cnt = 0
	for test.NextTestID.Valid {
		cnt += 1
		test, err = cfg.Db.GetCodeTestByID(r.Context(), test.NextTestID.UUID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				cfg.Logger.Printf("Problem not found: %v", test.NextTestID.UUID)
				http.Error(w, "Problem not found", http.StatusNotFound)
				return
			}
			cfg.Logger.Printf("Failed to retrieve problem: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.Db.CreateSolution(r.Context(), database.CreateSolutionParams{
		ID:         uuid.New(),
		ProblemID:  p.ProblemID,
		UserID:     sendingUser.ID,
		SentCode:   p.Code,
		Language:   p.Language,
		TotalTests: sql.NullInt32{Valid: true, Int32: int32(cnt)},
		CreatedAt:  sql.NullTime{Valid: true, Time: time.Now()},
		UpdatedAt:  sql.NullTime{Valid: true, Time: time.Now()},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to create solution: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, GenericPrinter)
}

func (cfg *ApiCfg) GetSolutionByIDHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received get solution by ID request")
	res, err := GetObjByQueryUUID(r, "solution_id", cfg.Db.GetSolutionByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Solution not found: %v", res.ID)
			http.Error(w, "Solution not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve solution: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if res.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
		cfg.Logger.Printf("Unauthorized access attempt to solution by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) DeleteSolutionHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received delete solution request")

	// Parse solution ID as UUID
	solution, err := GetObjByPathUUID(r, "solutionID", cfg.Db.GetSolutionByID)
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format or solution not found: %v", err)
		http.Error(w, "Invalid solution ID format or solution not found", http.StatusBadRequest)
		return
	}

	// Check if the sending user is the owner of the solution or an admin
	if solution.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
		cfg.Logger.Printf("Unauthorized delete attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	err = cfg.Db.DeleteSolution(r.Context(), solution.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to delete solution: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) GetSolutionsHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received get solutions request")
	solutions, err := cfg.Db.GetSolutions(r.Context(), database.GetSolutionsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve solutions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Filter solutions to only include those owned by the sending user or if the user is an admin
	var filteredSolutions []database.Solution
	for _, sol := range solutions {
		if sol.UserID == sendingUser.ID || UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
			filteredSolutions = append(filteredSolutions, sol)
		}
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, solutionsToAny(filteredSolutions), GenericPrinter)
}

func (cfg *ApiCfg) GetSolutionsByUserHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received get solutions by user request")

	// Parse user ID as UUID
	userID, err := GetUUIDFromQuery(r, "user_id")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	// Check if the sending user is the owner of the solutions or an admin
	if userID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
		cfg.Logger.Printf("Unauthorized access attempt to solutions by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	solutions, err := cfg.Db.GetSolutionsByUserID(r.Context(), database.GetSolutionsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve solutions by user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, solutionsToAny(solutions), GenericPrinter)
}

func (cfg *ApiCfg) GetSolutionsByProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received get solutions by problem request")

	// Parse problem ID as UUID
	problemID, err := GetUUIDFromQuery(r, "problem_id")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	solutions, err := cfg.Db.GetSolutionsByProblemID(r.Context(), database.GetSolutionsByProblemIDParams{
		ProblemID: problemID,
		Limit:     1000,
		Offset:    0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve solutions by problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Filter solutions to only include those owned by the sending user or if the user is an admin
	var filteredSolutions []database.Solution
	for _, sol := range solutions {
		if sol.UserID == sendingUser.ID || UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
			filteredSolutions = append(filteredSolutions, sol)
		}
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, solutionsToAny(filteredSolutions), GenericPrinter)
}

func (cfg *ApiCfg) UpdateSolutionTestsHandler(w http.ResponseWriter, r *http.Request, solution database.Solution, sendingUser database.User) {
	type params struct {
		GivenAnswers []string `json:"given_answers"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if solution.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionAdmin) {
		cfg.Logger.Printf("Unauthorized update attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	problem, err := cfg.Db.GetProblemByID(r.Context(), solution.ProblemID)
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve problem for solution: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	test, err := cfg.Db.GetCodeTestByID(r.Context(), problem.FirstTest.UUID)
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve first test for problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var testsPassed int32 = 0
	for i := 0; i < len(p.GivenAnswers) && test.ID != uuid.Nil; i++ {
		if p.GivenAnswers[i] == test.ExpectedOutput {
			testsPassed += 1
		}

		// Only move to the next test if there are still answers left to evaluate.
		if i == len(p.GivenAnswers)-1 {
			break
		}

		if test.NextTestID.Valid {
			test, err = cfg.Db.GetCodeTestByID(r.Context(), test.NextTestID.UUID)
			if err != nil {
				cfg.Logger.Printf("Failed to retrieve next test for problem: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		} else {
			cfg.Logger.Printf("Ran out of tests to check the answers to before answers were exhausted for solution: %v", solution.ID)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.Db.UpdateSolutionTests(r.Context(), database.UpdateSolutionTestsParams{
		ID:          solution.ID,
		TestsPassed: sql.NullInt32{Valid: true, Int32: testsPassed},
		UpdatedAt:   sql.NullTime{Valid: true, Time: time.Now()},
	})

	if err != nil {
		cfg.Logger.Printf("Failed to update solution percentage correct: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if solution.TotalTests.Int32 == testsPassed {
		_, err = cfg.MarkProblemUserSolved(solution.ProblemID, solution.UserID)
		if err != nil {
			if errors.Is(err, NoXpAddedErr) {
				cfg.Logger.Printf("No XP added to solution: %v", solution.ID)
			}
			cfg.Logger.Printf("Failed to mark problem as solved for user: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateSolutionFirstSolutionTestHandler(w http.ResponseWriter, r *http.Request, solution database.Solution, sendingUser database.User) {
	type params struct {
		FirstSolutionTestID uuid.UUID `json:"first_solution_test_id"`
	}
	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if solution.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionAdmin) {
		cfg.Logger.Printf("Unauthorized update attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	res, err := cfg.Db.UpdateSolutionFirstSolutionTest(r.Context(), database.UpdateSolutionFirstSolutionTestParams{
		ID:                  solution.ID,
		FirstSolutionTestID: uuid.NullUUID{UUID: p.FirstSolutionTestID, Valid: p.FirstSolutionTestID != uuid.Nil},
		UpdatedAt:           sql.NullTime{Valid: true, Time: time.Now()},
	})

	if err != nil {
		cfg.Logger.Printf("Failed to update solution first solution test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) CountSolutionsHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received count solutions request")

	countTotal, err := cfg.Db.CountSolutionsByUserId(r.Context(), sendingUser.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to count solutions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	countCorrect, err := cfg.Db.CountUserCorrectSolutions(r.Context(), sendingUser.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to count correct solutions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	type response struct {
		CountCorrect int64 `json:"count_correct"`
		CountTotal   int64 `json:"count_total"`
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, response{CountCorrect: countCorrect, CountTotal: countTotal}, GenericPrinter)
}

func (cfg *ApiCfg) CountSolutionsByProblemIDHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.Logger.Print("Received count solutions by problem ID request")
	// Parse problem ID as UUID
	problemID, err := GetUUIDFromQuery(r, "problem_id")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	countTotal, err := cfg.Db.CountUserSolutionsByProblemID(r.Context(), database.CountUserSolutionsByProblemIDParams{
		ProblemID: problemID,
		UserID:    sendingUser.ID,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to count solutions by problem ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	countCorrect, err := cfg.Db.CountUserCorrectSolutionsByProblemID(r.Context(), database.CountUserCorrectSolutionsByProblemIDParams{
		ProblemID: problemID,
		UserID:    sendingUser.ID,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to count correct solutions by problem ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	type response struct {
		CountCorrect int64 `json:"count_correct"`
		CountTotal   int64 `json:"count_total"`
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, response{CountCorrect: countCorrect, CountTotal: countTotal}, GenericPrinter)
}
