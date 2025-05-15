// API service for making HTTP requests to the backend

// Base URL - Adjust this to match your server's address
const API_BASE_URL = 'http://192.168.0.106:5000/api';

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
      data: data.data || null
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
