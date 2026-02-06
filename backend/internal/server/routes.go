package server

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers all HTTP routes.
// GET /countries is public; GET /visits and PUT /visits require auth middleware.
// Unmatched GET/HEAD requests are served from embedded static files (SPA fallback to index.html).
func (s *Server) RegisterRoutes() {
	s.Router.GET("/countries", func(c *gin.Context) {
		s.GetCountriesHandler(c.Request.Context(), c)
	})

	// Protected routes: require valid Firebase ID token
	protected := s.Router.Group("")
	protected.Use(s.authMiddleware())
	{
		protected.GET("/visits", func(c *gin.Context) {
			s.GetListHandler(c.Request.Context(), c)
		})
		protected.PUT("/visits", func(c *gin.Context) {
			s.PutVisitsHandler(c.Request.Context(), c)
		})
		protected.DELETE("/visits/:id", func(c *gin.Context) {
			s.DeleteVisitHandler(c.Request.Context(), c)
		})
	}

	// Static frontend: serve embedded files; unknown paths serve index.html (SPA fallback)
	s.Router.NoRoute(s.staticHandler)
}
