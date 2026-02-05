package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/matti777/my-countries/backend/internal/auth"
	"github.com/matti777/my-countries/backend/internal/config"
	"github.com/matti777/my-countries/backend/internal/database"
	"github.com/matti777/my-countries/backend/internal/logging"
	"github.com/matti777/my-countries/backend/internal/server"
	"github.com/matti777/my-countries/backend/internal/tracing"
)

func main() {
	ctx := context.Background()

	// Load configuration first (needed for project ID)
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize Cloud Trace client
	traceClient, err := tracing.NewClient(ctx, cfg.ProjectID, cfg.IsDebug)
	if err != nil {
		log.Printf("Warning: Failed to initialize trace client: %v. Continuing without tracing.", err)
		traceClient = nil
	} else {
		defer traceClient.Close()
	}

	// Initialize logger
	logger, err := logging.NewLogger(ctx, cfg.ProjectID)
	if err != nil {
		log.Printf("Warning: Failed to initialize logger: %v. Continuing without structured logging.", err)
		logger = nil
	} else {
		defer logger.Close()
	}

	// Store tracer and logger in context
	if traceClient != nil {
		ctx = traceClient.WithContext(ctx)
	}
	if logger != nil {
		ctx = logging.WithContext(ctx, logger)
	}

	slog := logging.FromContext(ctx)
	slog.Info("Starting application initialization")

	// Initialize Firestore client with trace span
	var dbClient *database.Client
	err = tracing.SafeSpan(ctx, nil, "database.NewClient", func(spanCtx context.Context) error {
		var err error
		dbClient, err = database.NewClient(spanCtx, cfg.ProjectID)
		return err
	})
	if err != nil {
		slog.Error("Failed to initialize Firestore client", logging.Error, err)
		log.Fatalf("Failed to initialize Firestore client: %v", err)
	}
	defer dbClient.Close()

	slog.Info("Firestore client initialized successfully")

	// Firebase ID token verification (JWKS cache 1h). Use FIREBASE_PROJECT_ID or FIREBASE_AUDIENCE when backend GCP project differs from frontend Firebase project.
	authenticator, err := auth.NewAuthenticator(cfg.ProjectID, cfg.FirebaseProjectID)
	if err != nil {
		slog.Error("Failed to create authenticator", logging.Error, err)
		log.Fatalf("Failed to create authenticator: %v", err)
	}
	effectiveFirebaseProject := cfg.ProjectID
	if cfg.FirebaseProjectID != "" {
		effectiveFirebaseProject = cfg.FirebaseProjectID
	}
	slog.Info("Firebase token verification configured", "firebase_project_id", effectiveFirebaseProject)

	// Create server with trace span
	var srv *server.Server
	err = tracing.SafeSpan(ctx, nil, "server.NewServer", func(spanCtx context.Context) error {
		srv = server.NewServer(spanCtx, dbClient, authenticator)
		srv.RegisterRoutes()
		return nil
	})
	if err != nil {
		slog.Error("Failed to create server", logging.Error, err)
		log.Fatalf("Failed to create server: %v", err)
	}

	slog.Info("Server created successfully")

	// Create HTTP server
	httpServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: srv.Router,
	}

	// Start server in a goroutine with trace span
	go func() {
		err := tracing.SafeSpan(ctx, nil, "httpServer.ListenAndServe", func(spanCtx context.Context) error {
			slog.Info("Server starting on port", logging.Port, cfg.Port)
			if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				return err
			}
			return nil
		})
		if err != nil {
			slog.Error("Server failed to start", logging.Error, err)
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")

	// Graceful shutdown with trace span
	err = tracing.SafeSpan(ctx, nil, "httpServer.Shutdown", func(spanCtx context.Context) error {
		shutdownCtx, cancel := context.WithCancel(spanCtx)
		defer cancel()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		slog.Error("Server forced to shutdown", logging.Error, err)
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	slog.Info("Server exited")
}
