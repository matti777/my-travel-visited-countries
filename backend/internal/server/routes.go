package server

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers all HTTP routes.
// GET /countries is public; GET /visits and PUT /visits require auth middleware.
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
	}
}
