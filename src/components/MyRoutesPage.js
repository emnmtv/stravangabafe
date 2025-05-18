import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getUserRoutes, saveRoute, deleteRoute, updateRoute } from '../services/apiService';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for start and end points
const startIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #4CAF50; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4]
});

const endIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #F44336; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4]
});

// Route Mini Map Component (similar to Home.js but simplified)
const RouteMiniMap = ({ route }) => {
  if (!route || !route.pathCoordinates || route.pathCoordinates.length < 2) {
    return (
      <div className="h-28 w-full bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
        No path data
      </div>
    );
  }

  const bounds = L.latLngBounds(route.pathCoordinates);

  return (
    <div className="h-28 w-full rounded overflow-hidden">
      <MapContainer
        key={`mini-map-${route._id}`}
        bounds={bounds}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <Polyline 
          positions={route.pathCoordinates}
          color="#4CAF50"
          weight={4}
          opacity={0.9}
        />
        
        <Marker position={route.startPoint} icon={startIcon} />
        <Marker position={route.endPoint} icon={endIcon} />
      </MapContainer>
    </div>
  );
};

const MyRoutesPage = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedRoute, setEditedRoute] = useState({
    title: '',
    description: '',
    isPublic: true
  });

  // OLONGAPO_COORDINATES as fallback
  const OLONGAPO_COORDINATES = [14.8386, 120.2842];

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('You must be logged in to view your routes');
        setLoading(false);
        return;
      }

      const response = await getUserRoutes(token);
      
      if (response.success) {
        // Transform routes to include Leaflet-compatible coordinates
        const processedRoutes = response.data.map(route => {
          // Create default values in case data is missing
          let pathCoordinates = [];
          let startPoint = OLONGAPO_COORDINATES;
          let endPoint = OLONGAPO_COORDINATES;
          
          // Process path coordinates directly from raw data
          try {
            let coordinates = [];
            
            if (typeof route.path === 'string') {
              // If path is a string, parse it
              try {
                const parsedPath = JSON.parse(route.path);
                coordinates = parsedPath.coordinates || [];
              } catch (e) {
                console.error('Error parsing path string:', e);
              }
            } else if (route.path && route.path.coordinates) {
              // If path is an object with coordinates property
              coordinates = route.path.coordinates;
            } else if (route.path && Array.isArray(route.path)) {
              // If path is directly an array of coordinates
              coordinates = route.path;
            }
            
            // Convert from GeoJSON [lng, lat] to Leaflet [lat, lng]
            if (Array.isArray(coordinates) && coordinates.length > 0) {
              pathCoordinates = coordinates.map(coord => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  return [coord[1], coord[0]]; // Swap to Leaflet format
                } else {
                  return OLONGAPO_COORDINATES;
                }
              });
            }
          } catch (e) {
            console.error('Error processing route path:', e);
          }
          
          // Process start point
          if (route.startPoint) {
            try {
              let startPointData = route.startPoint;
              
              if (typeof startPointData === 'string') {
                try {
                  startPointData = JSON.parse(startPointData);
                } catch(e) {
                  console.error('Error parsing start point:', e);
                }
              }
              
              if (startPointData.coordinates && Array.isArray(startPointData.coordinates) && startPointData.coordinates.length >= 2) {
                startPoint = [startPointData.coordinates[1], startPointData.coordinates[0]];
              }
            } catch (e) {
              console.error('Error processing start point:', e);
            }
          }
          
          // Process end point
          if (route.endPoint) {
            try {
              let endPointData = route.endPoint;
              
              if (typeof endPointData === 'string') {
                try {
                  endPointData = JSON.parse(endPointData);
                } catch(e) {
                  console.error('Error parsing end point:', e);
                }
              }
              
              if (endPointData.coordinates && Array.isArray(endPointData.coordinates) && endPointData.coordinates.length >= 2) {
                endPoint = [endPointData.coordinates[1], endPointData.coordinates[0]];
              }
            } catch (e) {
              console.error('Error processing end point:', e);
            }
          }
          
          return {
            ...route,
            pathCoordinates,
            startPoint,
            endPoint
          };
        });
        
        setRoutes(processedRoutes);
      } else {
        setError(response.message || 'Failed to fetch routes');
      }
    } catch (err) {
      setError('An error occurred while fetching routes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRouteClick = (route) => {
    setSelectedRoute(route);
    setShowDetails(true);
    setEditMode(false);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setEditMode(false);
  };

  const handleEditClick = (route) => {
    setEditedRoute({
      title: route.title || '',
      description: route.description || '',
      isPublic: route.isPublic !== false // Default to true if not specified
    });
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditedRoute({
      ...editedRoute,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleUpdateRoute = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('You must be logged in to update routes');
        return;
      }

      setLoading(true);
      const response = await updateRoute(token, selectedRoute._id, editedRoute);
      
      if (response.success) {
        // Update the route in the local state
        const updatedRoutes = routes.map(route => 
          route._id === selectedRoute._id 
            ? { ...route, ...editedRoute } 
            : route
        );
        
        setRoutes(updatedRoutes);
        setSelectedRoute({ ...selectedRoute, ...editedRoute });
        setEditMode(false);
        alert('Route updated successfully!');
      } else {
        alert('Failed to update route: ' + (response.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error updating route:', err);
      alert('An error occurred while updating the route');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('You must be logged in to delete routes');
        return;
      }

      setLoading(true);
      const response = await deleteRoute(token, routeId);
      
      if (response.success) {
        // Close modals and refresh routes list
        setConfirmDelete(null);
        setShowDetails(false);
        fetchRoutes();
        alert('Route deleted successfully!');
      } else {
        alert('Failed to delete route: ' + (response.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error deleting route:', err);
      alert('An error occurred while deleting the route');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = (route) => {
    setConfirmDelete(route);
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  // Filter routes based on active tab
  const filteredRoutes = routes.filter(route => {
    if (activeTab === 'all') return true;
    if (activeTab === 'completed') return route.completed;
    if (activeTab === 'incomplete') return !route.completed;
    return true;
  });

  // Calculate route stats
  const routeStats = {
    total: routes.length,
    completed: routes.filter(r => r.completed).length,
    incomplete: routes.filter(r => !r.completed).length,
    totalDistance: routes.reduce((sum, route) => sum + (route.distance || 0), 0)
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">My Routes</h1>
      
      {/* Route statistics */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Route Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Total Routes</div>
            <div className="text-xl font-bold">{routeStats.total}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-xl font-bold text-green-600">{routeStats.completed}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Incomplete</div>
            <div className="text-xl font-bold text-amber-500">{routeStats.incomplete}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-500">Total Distance</div>
            <div className="text-xl font-bold">{routeStats.totalDistance.toFixed(2)} km</div>
          </div>
        </div>
      </div>
      
      {/* Filter tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'all' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('all')}
        >
          All Routes
        </button>
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'completed' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
        <button 
          className={`py-2 px-4 font-medium ${activeTab === 'incomplete' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('incomplete')}
        >
          Incomplete
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center">
          <p className="text-gray-500">No routes found. Try adding routes from the home page.</p>
          <button 
            className="mt-4 py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            onClick={() => window.location.href = '/'}
          >
            Go to Home Page
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoutes.map((route) => (
            <div 
              key={route._id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200"
              onClick={() => handleRouteClick(route)}
            >
              <div className="relative">
                <RouteMiniMap route={route} />
                <div className="absolute top-2 left-2 bg-white bg-opacity-90 rounded px-2 py-1 text-xs font-medium">
                  {route.distance ? `${route.distance.toFixed(1)} km` : 'Unknown distance'}
                </div>
                {route.completed && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    Completed
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-800">{route.title || 'Unnamed Route'}</h3>
                  {route.isVerified && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">{route.description || 'No description'}</p>
                
                <div className="flex justify-between text-xs text-gray-600 mb-4">
                  <span>Distance: {route.distance || '?'} km</span>
                  <span>Elevation: {route.elevationGain || '?'} m</span>
                </div>
                
                <div className="flex justify-between">
                  <button 
                    className="py-1 px-3 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRouteClick(route);
                    }}
                  >
                    View Details
                  </button>
                  
                  <div className="flex gap-2">
                    {!route.completed && (
                      <button 
                        className="py-1 px-3 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRoute(route);
                          setShowDetails(true);
                          handleEditClick(route);
                        }}
                      >
                        Edit Details
                      </button>
                    )}
                    
                    <button 
                      className="py-1 px-3 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmDelete(route);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Route details modal */}
      {showDetails && selectedRoute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 2rem)' }}>
              {!editMode ? (
                <>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">{selectedRoute.title || 'Route Details'}</h2>
                      {selectedRoute.isVerified && (
                        <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Verified Route
                        </div>
                      )}
                    </div>
                    <button 
                      className="text-gray-500 hover:text-gray-700"
                      onClick={handleCloseDetails}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="h-64 mb-4 rounded-lg overflow-hidden relative">
                    <MapContainer
                      key={`detail-map-${selectedRoute._id}`}
                      bounds={L.latLngBounds(selectedRoute.pathCoordinates)}
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={true}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      
                      <Polyline 
                        positions={selectedRoute.pathCoordinates}
                        color="#4CAF50"
                        weight={5}
                        opacity={0.8}
                      />
                      
                      <Marker position={selectedRoute.startPoint} icon={startIcon}>
                        <Popup>Start point</Popup>
                      </Marker>
                      
                      <Marker position={selectedRoute.endPoint} icon={endIcon}>
                        <Popup>End point</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-gray-700 text-sm">{selectedRoute.description || 'No description provided.'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-500">Distance</div>
                      <div className="text-lg font-bold">{selectedRoute.distance?.toFixed(2) || '?'} km</div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-500">Elevation Gain</div>
                      <div className="text-lg font-bold">{selectedRoute.elevationGain || '0'} m</div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-xs text-gray-500">Status</div>
                      <div className={`text-lg font-bold ${selectedRoute.completed ? 'text-green-600' : 'text-amber-500'}`}>
                        {selectedRoute.completed ? 'Completed' : 'Not Completed'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      <button 
                        className="py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700"
                        onClick={() => {
                          handleCloseDetails();
                          // Navigate to home with this route selected
                          window.location.href = `/`;
                        }}
                      >
                        Start This Route
                      </button>
                      
                      <button 
                        className="py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={() => handleEditClick(selectedRoute)}
                      >
                        Edit Details
                      </button>
                    </div>
                    
                    <button 
                      className="py-2 px-4 bg-red-500 text-white rounded hover:bg-red-600"
                      onClick={() => handleConfirmDelete(selectedRoute)}
                    >
                      Delete Route
                    </button>
                  </div>
                </>
              ) : (
                // Edit Mode UI
                <>
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">Edit Route</h2>
                    <button 
                      className="text-gray-500 hover:text-gray-700"
                      onClick={handleCancelEdit}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Route Title
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={editedRoute.title}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter route title"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={editedRoute.description}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter route description"
                      ></textarea>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isPublic"
                        name="isPublic"
                        checked={editedRoute.isPublic}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                        Make this route public
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <button
                      className="py-2 px-4 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                    <button
                      className="py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700"
                      onClick={handleUpdateRoute}
                    >
                      Save Changes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Delete Route</h3>
            <p className="mb-6">Are you sure you want to delete the route "{confirmDelete.title}"? This action cannot be undone.</p>
            
            <div className="flex justify-end gap-3">
              <button 
                className="py-2 px-4 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button 
                className="py-2 px-4 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={() => handleDeleteRoute(confirmDelete._id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Refresh button */}
      <div className="mt-8 flex justify-center">
        <button 
          className="py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          onClick={fetchRoutes}
        >
          Refresh Routes
        </button>
      </div>
    </div>
  );
}

export default MyRoutesPage;