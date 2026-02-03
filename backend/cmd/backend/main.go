package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

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

	logging.LogInfo(ctx, "Starting application initialization")

	// Initialize Firestore client with trace span
	var dbClient *database.Client
	err = tracing.SafeSpan(ctx, nil, "database.NewClient", func(spanCtx context.Context) error {
		var err error
		dbClient, err = database.NewClient(spanCtx, cfg.ProjectID)
		return err
	})
	if err != nil {
		logging.LogError(ctx, "Failed to initialize Firestore client: %v", err)
		log.Fatalf("Failed to initialize Firestore client: %v", err)
	}
	defer dbClient.Close()

	logging.LogInfo(ctx, "Firestore client initialized successfully")

	// Create server with trace span
	var srv *server.Server
	err = tracing.SafeSpan(ctx, nil, "server.NewServer", func(spanCtx context.Context) error {
		srv = server.NewServer(spanCtx, dbClient)
		srv.RegisterRoutes()
		return nil
	})
	if err != nil {
		logging.LogError(ctx, "Failed to create server: %v", err)
		log.Fatalf("Failed to create server: %v", err)
	}

	logging.LogInfo(ctx, "Server created successfully")

	// Create HTTP server
	httpServer := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: srv.Router,
	}

	// Start server in a goroutine with trace span
	go func() {
		err := tracing.SafeSpan(ctx, nil, "httpServer.ListenAndServe", func(spanCtx context.Context) error {
			logging.LogInfo(spanCtx, "Server starting on port %s", cfg.Port)
			if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				return err
			}
			return nil
		})
		if err != nil {
			logging.LogError(ctx, "Server failed to start: %v", err)
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logging.LogInfo(ctx, "Shutting down server...")

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
		logging.LogError(ctx, "Server forced to shutdown: %v", err)
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	logging.LogInfo(ctx, "Server exited")
}
