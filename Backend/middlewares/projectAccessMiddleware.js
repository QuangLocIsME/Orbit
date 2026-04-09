/**
 * Project Access Middleware
 * Ensures user has proper access to project resources
 */

/**
 * Middleware factory to require project membership
 * @param {string} paramName - The route parameter name containing the project identifier
 */
const requireProjectMember = (paramName = 'projectId') => {
  return async (req, res, next) => {
    try {
      const projectIdentifier = req.params[paramName];
      
      if (!projectIdentifier) {
        return res.status(400).json({ 
          error: 'Project identifier is required' 
        });
      }

      // Get user ID from authenticated request
      const userId = req.user?.id || req.user?._id;
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      // TODO: Implement actual project membership check
      // This should query the database to verify:
      // 1. The project exists
      // 2. The user is a member of the project (owner, editor, or viewer)
      
      // For now, allow access - implement actual checks based on your auth model
      req.projectIdentifier = projectIdentifier;
      req.userProjectRole = 'member'; // Default role for now
      
      next();
    } catch (error) {
      console.error('Project access check error:', error);
      return res.status(500).json({ 
        error: 'Failed to verify project access' 
      });
    }
  };
};

/**
 * Middleware to check if user has at least editor role
 */
const requireProjectEditor = (paramName = 'projectId') => {
  return async (req, res, next) => {
    try {
      const projectIdentifier = req.params[paramName];
      
      if (!projectIdentifier) {
        return res.status(400).json({ 
          error: 'Project identifier is required' 
        });
      }

      const userId = req.user?.id || req.user?._id;
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      // TODO: Implement actual editor role check
      
      req.projectIdentifier = projectIdentifier;
      req.userProjectRole = 'editor';
      
      next();
    } catch (error) {
      console.error('Project editor check error:', error);
      return res.status(500).json({ 
        error: 'Failed to verify project editor access' 
      });
    }
  };
};

module.exports = {
  requireProjectMember,
  requireProjectEditor
};
