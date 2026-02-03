package server

import (
	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers all HTTP routes
func (s *Server) RegisterRoutes() {
	s.Router.GET("/countries", func(c *gin.Context) {
		s.GetCountriesHandler(c.Request.Context(), c)
	})
	s.Router.GET("/visits", func(c *gin.Context) {
		s.GetListHandler(c.Request.Context(), c)
	})
}
