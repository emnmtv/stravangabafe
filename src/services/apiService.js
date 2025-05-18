// API service for making HTTP requests to the backend

// Base URL - Adjust this to match your server's address
const API_BASE_URL = 'http://localhost:5500/api';
export const SOCKET_URL = 'http://localhost:5500';

// Helper function to format image URLs correctly
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // If it's already a full URL, return it
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // Otherwise, combine with the SOCKET_URL
  return `${SOCKET_URL}${imagePath}`;
};

// Helper function to handle API responses
const handleResponse = async (response) => {
  const data = await response.json();
  
  if (!response.ok) {
    // If response is not ok, throw an error with the server message or a default message
    throw new Error(data.message || 'An error occurred while processing your request');
  }
  
  return data;
};

// Authentication
export const register = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export const login = async (credentials) => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export const adminLogin = async (credentials) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    return await handleResponse(response);
  } catch (error) {
    console.error('Admin login error:', error);
    return { success: false, message: 'Network error during admin login' };
  }
};

// User profile management
export const getUserProfile = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Get profile error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export const updateUserProfile = async (token, profileData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Update profile error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Profile picture upload
export const uploadProfilePicture = async (token, imageFile) => {
  try {
    // Validate inputs
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required',
      };
    }
    
    if (!imageFile) {
      return {
        success: false,
        message: 'Image file is required',
      };
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('profilePicture', imageFile);
    
    // Send request - note: don't set Content-Type header when sending FormData
    console.log('Uploading profile picture...');
    const response = await fetch(`${API_BASE_URL}/profile/picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    const data = await handleResponse(response);
    
    return {
      success: true,
      message: 'Profile picture updated successfully',
      data: data.data,
    };
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return {
      success: false,
      message: error.message || 'Failed to upload profile picture',
    };
  }
};

// Route management
export const getUserRoutes = async (token) => {
  try {
    console.log('Fetching user routes with token:', token ? 'valid token' : 'no token');
    const response = await fetch(`${API_BASE_URL}/routes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('API getUserRoutes raw response:', data);
    
    // Log the paths from the first route to debug
    if (data.data && data.data.length > 0) {
      const sampleRoute = data.data[0];
      console.log('Sample route path data:', {
        id: sampleRoute._id,
        title: sampleRoute.title,
        pathType: sampleRoute.path ? sampleRoute.path.type : 'none',
        coordsCount: sampleRoute.path && sampleRoute.path.coordinates ? sampleRoute.path.coordinates.length : 0,
        sampleCoords: sampleRoute.path && sampleRoute.path.coordinates ? sampleRoute.path.coordinates.slice(0, 3) : []
      });
    }
    
    // Ensure we always return success and data fields 
    return {
      success: data.success || false,
      message: data.message || 'Unknown error',
      data: data.data || []
    };
  } catch (error) {
    console.error('Get routes error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch routes',
      data: []
    };
  }
};

export const getRouteById = async (token, routeId) => {
  if (!routeId) {
    console.error('Missing routeId in getRouteById');
    return {
      success: false,
      message: 'Route ID is required',
      data: null
    };
  }
  
  try {
    console.log(`Fetching route details for ID: ${routeId}`);
    const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('Route details raw response:', data);
    
    // Inspect route data structure to debug path coordinates
    if (data.data && data.data.path) {
      console.log('Route path structure:', {
        pathType: typeof data.data.path,
        isArray: Array.isArray(data.data.path),
        hasCoordinates: data.data.path.coordinates ? true : false,
        coordinatesCount: data.data.path.coordinates ? data.data.path.coordinates.length : 0
      });
      
      if (data.data.path.coordinates && data.data.path.coordinates.length > 0) {
        console.log('First few coordinates:', data.data.path.coordinates.slice(0, 3));
      }
    }
    
    return {
      success: data.success || false,
      message: data.message || 'Unknown error',
      data: data.data || null
    };
  } catch (error) {
    console.error('Get route error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch route details',
      data: null
    };
  }
};

// Delete a route by ID
export const deleteRoute = async (token, routeId) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }
    
    if (!routeId) {
      return {
        success: false,
        message: 'Route ID is required'
      };
    }
    
    console.log(`Deleting route with ID: ${routeId}`);
    const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await handleResponse(response);
    console.log('Delete route response:', data);
    
    return {
      success: data.success || false,
      message: data.message || 'Route deleted successfully'
    };
  } catch (error) {
    console.error('Delete route error:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete route'
    };
  }
};

export const saveRoute = async (token, routeData) => {
  if (!routeData) {
    console.error('Invalid route data in saveRoute: routeData is null or undefined');
    return {
      success: false,
      message: 'Invalid route data. Route data is required.',
      data: null
    };
  }
  
  if (!routeData.title || routeData.title.trim() === '') {
    console.error('Invalid route data in saveRoute: missing title');
    return {
      success: false,
      message: 'Title is required.',
      data: null
    };
  }
  
  if (!routeData.distance || isNaN(routeData.distance) || routeData.distance <= 0) {
    console.error('Invalid route data in saveRoute: invalid distance', routeData.distance);
    return {
      success: false,
      message: 'A valid distance value is required.',
      data: null
    };
  }
  
  if (!routeData.path) {
    console.error('Invalid route data in saveRoute: missing path');
    return {
      success: false,
      message: 'Path is required.',
      data: null
    };
  }
  
  try {
    // Log the data being sent to the server
    console.log('Saving route with data:', JSON.stringify(routeData, null, 2));
    
    // Create a deep copy to avoid modifying the original object
    const preparedData = { ...routeData };
    
    // Parse path if it's a string (handle both formats)
    if (typeof preparedData.path === 'string') {
      try {
        preparedData.path = JSON.parse(preparedData.path);
        console.log('Successfully parsed path string to object', preparedData.path);
      } catch (err) {
        console.error('Error parsing path string:', err);
        return {
          success: false,
          message: 'Invalid path format: could not parse path data',
          data: null
        };
      }
    }
    
    // Parse startPoint if it's a string
    if (typeof preparedData.startPoint === 'string') {
      try {
        preparedData.startPoint = JSON.parse(preparedData.startPoint);
        console.log('Successfully parsed startPoint string to object', preparedData.startPoint);
      } catch (err) {
        console.error('Error parsing startPoint string:', err);
        return {
          success: false,
          message: 'Invalid startPoint format: could not parse startPoint data',
          data: null
        };
      }
    }
    
    // Parse endPoint if it's a string
    if (typeof preparedData.endPoint === 'string') {
      try {
        preparedData.endPoint = JSON.parse(preparedData.endPoint);
        console.log('Successfully parsed endPoint string to object', preparedData.endPoint);
      } catch (err) {
        console.error('Error parsing endPoint string:', err);
        return {
          success: false,
          message: 'Invalid endPoint format: could not parse endPoint data',
          data: null
        };
      }
    }
    
    // Ensure path is properly formatted as GeoJSON if not already
    if (!preparedData.path.type) {
      preparedData.path = {
        type: 'LineString',
        coordinates: preparedData.path.coordinates || []
      };
    }
    
    // Debug log to check the structure after parsing
    console.log('Path structure after parsing:', {
      type: preparedData.path.type,
      coordsCount: preparedData.path.coordinates ? preparedData.path.coordinates.length : 0
    });
    
    // Ensure the path has at least 2 coordinates
    if (!preparedData.path.coordinates || preparedData.path.coordinates.length < 2) {
      console.error('Invalid route data: path has insufficient coordinates', 
        preparedData.path.coordinates ? preparedData.path.coordinates.length : 0);
      return {
        success: false,
        message: 'Route must have at least 2 coordinates',
        data: null
      };
    }
    
    // Ensure coordinates are properly formatted as [longitude, latitude]
    const validCoordinates = preparedData.path.coordinates.every(coord => 
      Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1])
    );
    
    if (!validCoordinates) {
      console.error('Invalid coordinates in path:', preparedData.path.coordinates);
      return {
        success: false,
        message: 'Route contains invalid coordinates',
        data: null
      };
    }
    
    // Check start and end point format
    if (!preparedData.startPoint || !preparedData.startPoint.coordinates || 
        !Array.isArray(preparedData.startPoint.coordinates) || 
        preparedData.startPoint.coordinates.length < 2) {
      console.error('Invalid startPoint:', preparedData.startPoint);
      return {
        success: false,
        message: 'Valid start point is required',
        data: null
      };
    }
    
    if (!preparedData.endPoint || !preparedData.endPoint.coordinates || 
        !Array.isArray(preparedData.endPoint.coordinates) || 
        preparedData.endPoint.coordinates.length < 2) {
      console.error('Invalid endPoint:', preparedData.endPoint);
      return {
        success: false,
        message: 'Valid end point is required',
        data: null
      };
    }
    
    // Make the API request
    console.log('Sending prepared route data to server:', preparedData);
    const response = await fetch(`${API_BASE_URL}/routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(preparedData),
    });
    
    // For debugging - log the raw response
    console.log('Save route response status:', response.status);
    
    // Handle non-JSON responses (e.g., HTML error pages)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Server returned non-JSON response:', contentType);
      const textResponse = await response.text();
      console.error('Raw response:', textResponse.substring(0, 500) + (textResponse.length > 500 ? '...' : ''));
      throw new Error('Server returned an invalid response format');
    }
    
    const data = await response.json();
    console.log('Save route response data:', data);
    
    if (!response.ok) {
      console.error('Server error during route save:', data);
      return {
        success: false,
        message: data.message || `Server error: ${response.status}`,
        data: null
      };
    }
    
    return {
      success: data.success || true,
      message: data.message || 'Route saved successfully',
      data: data.data || null,
      duplicate: data.duplicate || false
    };
  } catch (error) {
    console.error('Save route error:', error);
    return {
      success: false,
      message: `Failed to save route: ${error.message}`,
      data: null
    };
  }
};

export const generateRoute = async (token, routeOptions) => {
  if (!routeOptions || !routeOptions.latitude || !routeOptions.longitude) {
    console.error('Missing required options in generateRoute:', routeOptions);
    return {
      success: false,
      message: 'Location coordinates are required',
      data: null
    };
  }
  
  try {
    console.log('Generating route with options:', routeOptions);
    const response = await fetch(`${API_BASE_URL}/generate-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(routeOptions),
    });
    
    const data = await handleResponse(response);
    console.log('Route generation response:', data);
    
    return {
      success: data.success || false,
      message: data.message || 'Unknown error',
      data: data.data || null
    };
  } catch (error) {
    console.error('Generate route error:', error);
    return {
      success: false,
      message: error.message || 'Failed to generate route',
      data: null
    };
  }
};

// Activity tracking
export const startSession = async (token, initialLocation) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(initialLocation),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Start session error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Start session with specific activity type
export const startSessionWithActivityType = async (token, data) => {
  try {
    // Check for required fields
    if (!data.initialLocation) {
      return {
        success: false,
        message: 'Initial location is required',
      };
    }
    
    // Ensure activityType is one of the valid types
    const validTypes = ['run', 'jog', 'walk', 'cycling', 'hiking', 'other'];
    if (!data.activityType || !validTypes.includes(data.activityType)) {
      // Default to 'run' if not specified or invalid
      data.activityType = 'run';
    }
    
    console.log(`Starting session with activity type: ${data.activityType}`);
    
    const response = await fetch(`${API_BASE_URL}/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Start session error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export const updateSession = async (token, sessionData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(sessionData),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Update session error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export const stopSession = async (token, finalData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(finalData),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Stop session error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export const getActiveSession = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/active`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Get active session error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

export const resetSession = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Reset session error:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Activity management functions
export const getUserActivities = async (token, options = {}) => {
  try {
    // Build query params
    const queryParams = new URLSearchParams();
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.skip) queryParams.append('skip', options.skip);
    if (options.sort) queryParams.append('sort', options.sort);
    if (options.type) queryParams.append('type', options.type);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    console.log('Fetching user activities with options:', options);
    
    const response = await fetch(`${API_BASE_URL}/activities${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('API getUserActivities response:', data);
    
    return {
      success: data.success || false,
      count: data.count || 0,
      total: data.total || 0,
      message: data.message || '',
      data: data.data || []
    };
  } catch (error) {
    console.error('Get activities error:', error);
    return {
      success: false,
      count: 0,
      total: 0,
      message: error.message || 'Failed to fetch activities',
      data: []
    };
  }
};

export const getActivityById = async (token, activityId) => {
  if (!activityId) {
    console.error('Missing activityId in getActivityById');
    return {
      success: false,
      message: 'Activity ID is required',
      data: null
    };
  }
  
  try {
    console.log(`Fetching activity details for ID: ${activityId}`);
    const response = await fetch(`${API_BASE_URL}/activities/${activityId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('Activity details response:', data);
    
    return {
      success: data.success || false,
      message: data.message || 'Unknown error',
      data: data.data || null
    };
  } catch (error) {
    console.error('Get activity error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch activity details',
      data: null
    };
  }
};

// Get routes near a location
export const getNearbyRoutes = async (params) => {
  try {
    // Validate required parameters
    if (!params.latitude || !params.longitude) {
      console.error('Missing location coordinates in getNearbyRoutes:', params);
      return {
        success: false,
        count: 0,
        message: 'Current location coordinates are required to find nearby routes',
        data: []
      };
    }
    
    // Convert coordinates to numbers if they're strings
    const latitude = parseFloat(params.latitude);
    const longitude = parseFloat(params.longitude);
    
    // Validate coordinates are valid numbers
    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.error('Invalid coordinates in getNearbyRoutes:', { latitude, longitude });
      return {
        success: false,
        count: 0,
        message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180',
        data: []
      };
    }
    
    // Build query params
    const queryParams = new URLSearchParams();
    queryParams.append('latitude', latitude);
    queryParams.append('longitude', longitude);
    
    // Set default max distance to 5km if not provided
    const maxDistance = params.maxDistance ? parseFloat(params.maxDistance) : 5;
    queryParams.append('maxDistance', maxDistance);
    
    const queryString = `?${queryParams.toString()}`;
    console.log(`Fetching routes within ${maxDistance}km of location: [${latitude}, ${longitude}]`);
    
    const response = await fetch(`${API_BASE_URL}/routes/nearby${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await handleResponse(response);
    console.log(`Found ${data.count || 0} routes near user's location`);
    
    return {
      success: data.success || false,
      count: data.count || 0,
      message: data.message || '',
      data: data.data || []
    };
  } catch (error) {
    console.error('Get nearby routes error:', error);
    return {
      success: false,
      count: 0,
      message: error.message || 'Failed to fetch nearby routes',
      data: []
    };
  }
};

// Admin: Verify a route
export const verifyRoute = async (token, routeId) => {
  try {
    if (!token) throw new Error('Authentication token required');
    if (!routeId) throw new Error('Route ID required');

    const response = await fetch(`${API_BASE_URL}/admin/routes/verify/${routeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error verifying route:', error);
    return {
      success: false,
      message: error.message || 'Failed to verify route'
    };
  }
};

// Admin: Create route manually
export const adminCreateRoute = async (token, routeData) => {
  try {
    if (!token) throw new Error('Authentication token required');
    if (!routeData) throw new Error('Route data required');

    // Ensure required fields are present
    const requiredFields = ['title', 'distance', 'startPoint', 'endPoint', 'path'];
    for (const field of requiredFields) {
      if (!routeData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const response = await fetch(`${API_BASE_URL}/admin/routes/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(routeData)
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating route:', error);
    return {
      success: false,
      message: error.message || 'Failed to create route'
    };
  }
};

// Add these new functions for admin route management
export const getAdminPendingRoutes = async (token) => {
  try {
    console.log('Fetching pending routes for admin with token:', token ? 'valid token' : 'no token');
    
    const response = await fetch(`${API_BASE_URL}/admin/routes/pending`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('API getAdminPendingRoutes raw response:', data);
    
    return {
      success: true,
      data: data.data,
      count: data.count
    };
  } catch (error) {
    console.error('Error fetching pending routes for admin:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch pending routes',
      data: []
    };
  }
};

export const getAdminAllRoutes = async (token) => {
  try {
    console.log('Fetching all routes for admin with token:', token ? 'valid token' : 'no token');
    
    const response = await fetch(`${API_BASE_URL}/admin/routes/all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('API getAdminAllRoutes raw response:', data);
    
    return {
      success: true,
      data: data.data,
      count: data.count
    };
  } catch (error) {
    console.error('Error fetching all routes for admin:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch routes',
      data: []
    };
  }
};

// Add function for users to manually create routes
export const createRouteManually = async (token, routeData) => {
  try {
    console.log('Creating route manually with token:', token ? 'valid token' : 'no token');
    
    const response = await fetch(`${API_BASE_URL}/routes/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(routeData)
    });
    
    const data = await handleResponse(response);
    console.log('API createRouteManually response:', data);
    
    return {
      success: true,
      message: 'Route created successfully',
      data: data.data
    };
  } catch (error) {
    console.error('Error creating route manually:', error);
    return {
      success: false,
      message: error.message || 'Failed to create route',
    };
  }
};

// Update user privacy settings
export const updatePrivacySettings = async (token, privacyData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/profile/privacy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(privacyData),
    });
    
    return handleResponse(response);
  } catch (error) {
    console.error('Update privacy settings error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update privacy settings',
    };
  }
};

// Get user activity statistics
export const getUserStats = async (token, options = {}) => {
  try {
    // Build query params for date filtering and activity type
    const queryParams = new URLSearchParams();
    if (options.startDate) queryParams.append('startDate', options.startDate);
    if (options.endDate) queryParams.append('endDate', options.endDate);
    if (options.type) queryParams.append('type', options.type);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    console.log('Fetching user stats with options:', options);
    
    const response = await fetch(`${API_BASE_URL}/activities/stats/summary${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('API getUserStats response:', data);
    
    return {
      success: data.success || false,
      message: data.message || '',
      data: data.data || {
        totalActivities: 0,
        totalDistance: 0,
        totalDuration: 0,
        totalSteps: 0,
        totalCalories: 0,
        totalElevationGain: 0,
        recentActivities: []
      }
    };
  } catch (error) {
    console.error('Get user stats error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch user statistics',
      data: {
        totalActivities: 0,
        totalDistance: 0,
        totalDuration: 0,
        totalSteps: 0,
        totalCalories: 0,
        totalElevationGain: 0,
        recentActivities: []
      }
    };
  }
};

// Add weight entry without replacing current profile weight
export const addWeightEntry = async (token, weightData) => {
  try {
    // Validate input
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }
    
    if (!weightData || !weightData.weight) {
      return {
        success: false,
        message: 'Weight value is required'
      };
    }
    
    // Make sure weight is a valid number
    const weight = parseFloat(weightData.weight);
    if (isNaN(weight) || weight <= 0 || weight > 300) {
      return {
        success: false,
        message: 'Weight must be a positive number between 1 and 300 kg'
      };
    }
    
    const response = await fetch(`${API_BASE_URL}/profile/weight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(weightData)
    });
    
    const data = await handleResponse(response);
    
    return {
      success: true,
      message: 'Weight entry added successfully',
      data: data.data
    };
  } catch (error) {
    console.error('Weight entry error:', error);
    return {
      success: false,
      message: error.message || 'Failed to add weight entry'
    };
  }
};

// Get weight history
export const getWeightHistory = async (token, options = {}) => {
  try {
    // Build query params for date filtering
    const queryParams = new URLSearchParams();
    if (options.startDate) queryParams.append('startDate', options.startDate);
    if (options.endDate) queryParams.append('endDate', options.endDate);
    if (options.limit) queryParams.append('limit', options.limit);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    console.log('Fetching weight history with options:', options);
    
    const response = await fetch(`${API_BASE_URL}/profile/weight/history${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await handleResponse(response);
    console.log('API getWeightHistory response:', data);
    
    return {
      success: data.success || false,
      count: data.count || 0,
      message: data.message || '',
      data: data.data || []
    };
  } catch (error) {
    console.error('Get weight history error:', error);
    return {
      success: false,
      count: 0,
      message: error.message || 'Failed to fetch weight history',
      data: []
    };
  }
};

/**
 * Get distance history for the current user
 * @param {string} token - Auth token
 * @param {Object} params - Optional query parameters (limit, startDate, endDate)
 */
export const getDistanceHistory = async (token, params = {}) => {
  try {
    // Build query string from params
    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const url = `${API_BASE_URL}/profile/distance/history${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching distance history:', error);
    return { success: false, message: 'Failed to fetch distance history' };
  }
};

/**
 * Get distance statistics for the current user
 * @param {string} token - Auth token
 * @param {string} period - Time period for stats ('week', 'month', 'year', 'all')
 */
export const getDistanceStats = async (token, period = 'all') => {
  try {
    const url = `${API_BASE_URL}/profile/distance/stats?period=${period}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching distance stats:', error);
    return { success: false, message: 'Failed to fetch distance statistics' };
  }
};

/**
 * Recalculate total distance for the current user
 * @param {string} token - Auth token
 */
export const recalculateDistance = async (token) => {
  try {
    const url = `${API_BASE_URL}/profile/distance/recalculate`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Recalculate distance response:', data);
    return data;
  } catch (error) {
    console.error('Error recalculating distance:', error);
    return { success: false, message: 'Failed to recalculate total distance' };
  }
};

// Challenge management
export const createChallenge = async (token, challengeData) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }

    // Validate required fields
    const requiredFields = ['title', 'description', 'type', 'goal', 'startDate', 'endDate'];
    for (const field of requiredFields) {
      if (!challengeData[field]) {
        return {
          success: false,
          message: `Missing required field: ${field}`
        };
      }
    }

    const response = await fetch(`${API_BASE_URL}/admin/challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(challengeData)
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Create challenge error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create challenge'
    };
  }
};

export const getAllChallenges = async (token, isActive) => {
  try {
    const queryParams = isActive !== undefined ? `?active=${isActive}` : '';
    
    const response = await fetch(`${API_BASE_URL}/challenges${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Get challenges error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch challenges',
      data: []
    };
  }
};

export const getChallengeById = async (token, challengeId) => {
  try {
    if (!challengeId) {
      return {
        success: false,
        message: 'Challenge ID is required'
      };
    }

    const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Get challenge details error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch challenge details',
      data: null
    };
  }
};

export const updateChallenge = async (token, challengeId, updateData) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }

    if (!challengeId) {
      return {
        success: false,
        message: 'Challenge ID is required'
      };
    }

    const response = await fetch(`${API_BASE_URL}/admin/challenges/${challengeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Update challenge error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update challenge'
    };
  }
};

export const deleteChallenge = async (token, challengeId) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }

    if (!challengeId) {
      return {
        success: false,
        message: 'Challenge ID is required'
      };
    }

    const response = await fetch(`${API_BASE_URL}/admin/challenges/${challengeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Delete challenge error:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete challenge'
    };
  }
};

export const joinChallenge = async (token, challengeId) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }

    if (!challengeId) {
      return {
        success: false,
        message: 'Challenge ID is required'
      };
    }

    const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Join challenge error:', error);
    return {
      success: false,
      message: error.message || 'Failed to join challenge'
    };
  }
};

export const leaveChallenge = async (token, challengeId) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }

    if (!challengeId) {
      return {
        success: false,
        message: 'Challenge ID is required'
      };
    }

    const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/leave`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Leave challenge error:', error);
    return {
      success: false,
      message: error.message || 'Failed to leave challenge'
    };
  }
};

export const getUserChallenges = async (token, status) => {
  try {
    const queryParams = status ? `?status=${status}` : '';
    
    const response = await fetch(`${API_BASE_URL}/user/challenges${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Get user challenges error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch challenges',
      data: []
    };
  }
};

export const getChallengeLeaderboard = async (token, challengeId) => {
  try {
    if (!challengeId) {
      return {
        success: false,
        message: 'Challenge ID is required'
      };
    }

    const response = await fetch(`${API_BASE_URL}/admin/challenges/leaderboard/${challengeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Get challenge leaderboard error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch leaderboard',
      data: null
    };
  }
};

// Archive an activity without deleting it
export const archiveActivity = async (token, activityId) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }
    
    if (!activityId) {
      return {
        success: false,
        message: 'Activity ID is required'
      };
    }
    
    console.log(`Archiving activity with ID: ${activityId}`);
    const response = await fetch(`${API_BASE_URL}/activities/${activityId}/archive`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await handleResponse(response);
    console.log('Archive activity response:', data);
    
    return {
      success: data.success || false,
      message: data.message || 'Activity archived successfully',
      data: data.data
    };
  } catch (error) {
    console.error('Archive activity error:', error);
    return {
      success: false,
      message: error.message || 'Failed to archive activity'
    };
  }
};

// Get archived activities
export const getArchivedActivities = async (token, options = {}) => {
  try {
    // Build query params
    const queryParams = new URLSearchParams();
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.skip) queryParams.append('skip', options.skip);
    if (options.sort) queryParams.append('sort', options.sort);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    console.log('Fetching archived activities with options:', options);
    
    const response = await fetch(`${API_BASE_URL}/activities/archived${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse(response);
    console.log('API getArchivedActivities response:', data);
    
    return {
      success: data.success || false,
      count: data.count || 0,
      total: data.total || 0,
      message: data.message || '',
      data: data.data || []
    };
  } catch (error) {
    console.error('Get archived activities error:', error);
    return {
      success: false,
      count: 0,
      total: 0,
      message: error.message || 'Failed to fetch archived activities',
      data: []
    };
  }
};

// Restore an archived activity
export const restoreActivity = async (token, activityId) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }
    
    if (!activityId) {
      return {
        success: false,
        message: 'Activity ID is required'
      };
    }
    
    console.log(`Restoring activity with ID: ${activityId}`);
    const response = await fetch(`${API_BASE_URL}/activities/${activityId}/restore`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await handleResponse(response);
    console.log('Restore activity response:', data);
    
    return {
      success: data.success || false,
      message: data.message || 'Activity restored successfully',
      data: data.data
    };
  } catch (error) {
    console.error('Restore activity error:', error);
    return {
      success: false,
      message: error.message || 'Failed to restore activity'
    };
  }
};

// Update route details
export const updateRoute = async (token, routeId, updateData) => {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Authentication token is required'
      };
    }
    
    if (!routeId) {
      return {
        success: false,
        message: 'Route ID is required'
      };
    }
    
    console.log(`Updating route with ID: ${routeId}`, updateData);
    
    const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });
    
    const data = await handleResponse(response);
    console.log('Update route response:', data);
    
    return {
      success: data.success || false,
      message: data.message || 'Route updated successfully',
      data: data.data
    };
  } catch (error) {
    console.error('Update route error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update route'
    };
  }
};
