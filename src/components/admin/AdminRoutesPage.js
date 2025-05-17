import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { 
  verifyRoute, 
  adminCreateRoute,
  getAdminPendingRoutes,
  getAdminAllRoutes
} from '../../services/apiService';
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
  html: `<div style="background-color: #4CAF50; width: 12px; height: 12px; border-radius: 50%; position: relative; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4);">
          <div style="position: absolute; width: 30px; height: 20px; background-color: #4CAF50; left: 10px; top: -5px; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; box-shadow: 0 0 3px rgba(0,0,0,0.4);">
            START
          </div>
         </div>`,
  iconSize: [48, 42],
  iconAnchor: [6, 6]
});

const endIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #F44336; width: 12px; height: 12px; border-radius: 50%; position: relative; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4);">
          <div style="position: absolute; width: 30px; height: 20px; background-color: #F44336; left: 10px; top: -5px; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; box-shadow: 0 0 3px rgba(0,0,0,0.4);">
            END
          </div>
         </div>`,
  iconSize: [48, 42],
  iconAnchor: [6, 6]
});

// Mini map for route preview
const RouteMiniMap = ({ route }) => {
  const [mapRef, setMapRef] = useState(null);

  useEffect(() => {
    if (mapRef && route && route.pathCoordinates && route.pathCoordinates.length > 0) {
      setTimeout(() => {
        try {
          mapRef.invalidateSize();
          const bounds = L.latLngBounds(route.pathCoordinates);
          mapRef.fitBounds(bounds, { padding: [5, 5] });
        } catch (e) {
          console.error("Error setting mini map bounds:", e);
        }
      }, 100);
    }
  }, [mapRef, route]);

  if (!route || !route.pathCoordinates || route.pathCoordinates.length < 2) {
    return <div className="h-28 w-full bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">No path data</div>;
  }

  return (
    <div className="h-28 w-full rounded overflow-hidden">
      <MapContainer
        center={route.startPoint}
        zoom={12}
        ref={setMapRef}
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
        
        <Marker position={route.startPoint} icon={startIcon}>
          <Popup>Start Point</Popup>
        </Marker>
        
        <Marker position={route.endPoint} icon={endIcon}>
          <Popup>End Point</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

const AdminRoutesPage = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'verified', 'unverified'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'distance'
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New route form state
  const [newRoute, setNewRoute] = useState({
    title: '',
    description: '',
    distance: 0,
    elevationGain: 0,
    userId: '', // Optional: assign to a specific user
    isPublic: true,
    isVerified: true,
    startPoint: {
      type: 'Point',
      coordinates: [0, 0]
    },
    endPoint: {
      type: 'Point',
      coordinates: [0, 0]
    },
    path: {
      type: 'LineString',
      coordinates: []
    }
  });
  
  // Processing of routes to add Leaflet-compatible coordinates
  const processRouteCoordinates = (route) => {
    try {
      // Default values
      let pathCoordinates = [];
      let startPoint = [0, 0];
      let endPoint = [0, 0];
      
      // Process path coordinates
      if (route.path) {
        if (typeof route.path === 'string') {
          try {
            const parsed = JSON.parse(route.path);
            if (parsed.coordinates) {
              pathCoordinates = parsed.coordinates.map(coord => [coord[1], coord[0]]);
            }
          } catch (e) {
            console.error('Error parsing path JSON:', e);
          }
        } else if (route.path.coordinates) {
          pathCoordinates = route.path.coordinates.map(coord => [coord[1], coord[0]]);
        }
      }
      
      // Process start point
      if (route.startPoint) {
        if (typeof route.startPoint === 'string') {
          try {
            const parsed = JSON.parse(route.startPoint);
            if (parsed.coordinates) {
              startPoint = [parsed.coordinates[1], parsed.coordinates[0]];
            }
          } catch (e) {
            console.error('Error parsing startPoint JSON:', e);
          }
        } else if (route.startPoint.coordinates) {
          startPoint = [route.startPoint.coordinates[1], route.startPoint.coordinates[0]];
        }
      }
      
      // Process end point
      if (route.endPoint) {
        if (typeof route.endPoint === 'string') {
          try {
            const parsed = JSON.parse(route.endPoint);
            if (parsed.coordinates) {
              endPoint = [parsed.coordinates[1], parsed.coordinates[0]];
            }
          } catch (e) {
            console.error('Error parsing endPoint JSON:', e);
          }
        } else if (route.endPoint.coordinates) {
          endPoint = [route.endPoint.coordinates[1], route.endPoint.coordinates[0]];
        }
      }
      
      return {
        ...route,
        pathCoordinates,
        startPoint,
        endPoint
      };
    } catch (error) {
      console.error('Error processing route coordinates:', error);
      return route;
    }
  };
  
  // Fetch all routes (admin has access to all routes)
  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }
      
      // Use the filter to determine which API to call
      let response;
      if (filter === 'unverified') {
        response = await getAdminPendingRoutes(token);
      } else {
        response = await getAdminAllRoutes(token);
      }
      
      if (response.success) {
        // Transform data for Leaflet
        const processedRoutes = response.data.map(route => processRouteCoordinates(route));
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
  
  useEffect(() => {
    fetchRoutes();
  }, [filter]);
  
  // Handle verifying a route
  const handleVerifyRoute = async (routeId) => {
    if (!window.confirm("Are you sure you want to verify this route?")) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }
      
      const response = await verifyRoute(token, routeId);
      
      if (response.success) {
        // Update routes list with the verified route
        setRoutes(routes.map(route => 
          route._id === routeId 
            ? { 
                ...route, 
                isVerified: true,
                verificationDate: new Date(),
              }
            : route
        ));
        alert('Route verified successfully');
      } else {
        alert(`Failed to verify route: ${response.message}`);
      }
    } catch (err) {
      console.error('Error verifying route:', err);
      alert(`Error: ${err.message}`);
    }
  };
  
  // Handle creating a new route
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        return;
      }
      
      // Validate path has at least 2 points
      if (!newRoute.path.coordinates || newRoute.path.coordinates.length < 2) {
        alert('Path must contain at least 2 points');
        return;
      }
      
      const response = await adminCreateRoute(token, newRoute);
      
      if (response.success) {
        const createdRoute = processRouteCoordinates(response.data);
        setRoutes([createdRoute, ...routes]);
        setShowCreateForm(false);
        setNewRoute({
          title: '',
          description: '',
          distance: 0,
          elevationGain: 0,
          userId: '',
          isPublic: true,
          isVerified: true,
          startPoint: {
            type: 'Point',
            coordinates: [0, 0]
          },
          endPoint: {
            type: 'Point',
            coordinates: [0, 0]
          },
          path: {
            type: 'LineString',
            coordinates: []
          }
        });
        alert('Route created successfully');
      } else {
        alert(`Failed to create route: ${response.message}`);
      }
    } catch (err) {
      console.error('Error creating route:', err);
      alert(`Error: ${err.message}`);
    }
  };
  
  // Handle changes to form inputs
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    // For checkboxes, use checked property instead of value
    if (type === 'checkbox') {
      setNewRoute({ ...newRoute, [name]: e.target.checked });
      return;
    }
    
    // For number inputs, parse as float
    if (type === 'number') {
      setNewRoute({ ...newRoute, [name]: parseFloat(value) || 0 });
      return;
    }
    
    // For other inputs, use value directly
    setNewRoute({ ...newRoute, [name]: value });
  };
  
  // Handle changes to coordinates
  const handleCoordinateChange = (type, index, coordIndex, value) => {
    const updatedRoute = { ...newRoute };
    
    if (type === 'path') {
      // Ensure path coordinates array exists and has enough elements
      if (!updatedRoute.path.coordinates[index]) {
        updatedRoute.path.coordinates[index] = [0, 0];
      }
      updatedRoute.path.coordinates[index][coordIndex] = parseFloat(value) || 0;
    } else if (type === 'start' || type === 'end') {
      const pointKey = type === 'start' ? 'startPoint' : 'endPoint';
      updatedRoute[pointKey].coordinates[coordIndex] = parseFloat(value) || 0;
    }
    
    setNewRoute(updatedRoute);
  };
  
  // Add a new coordinate pair to the path
  const addPathCoordinate = () => {
    setNewRoute({
      ...newRoute,
      path: {
        ...newRoute.path,
        coordinates: [...newRoute.path.coordinates, [0, 0]]
      }
    });
  };
  
  // Remove a coordinate pair from the path
  const removePathCoordinate = (index) => {
    const updatedCoordinates = [...newRoute.path.coordinates];
    updatedCoordinates.splice(index, 1);
    
    setNewRoute({
      ...newRoute,
      path: {
        ...newRoute.path,
        coordinates: updatedCoordinates
      }
    });
  };
  
  // Filter routes based on current filter and search query
  const filteredRoutes = routes.filter(route => {
    // Filter by verification status
    if (filter === 'verified' && !route.isVerified) return false;
    if (filter === 'unverified' && route.isVerified) return false;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        route.title?.toLowerCase().includes(query) ||
        route.description?.toLowerCase().includes(query) ||
        route.user?.username?.toLowerCase().includes(query) ||
        route.user?.firstName?.toLowerCase().includes(query) ||
        route.user?.lastName?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });
  
  // Sort routes based on current sort option
  const sortedRoutes = [...filteredRoutes].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'oldest':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'distance':
        return b.distance - a.distance;
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Route Administration</h1>
      
      {/* Actions Bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search routes..."
              className="w-full md:w-64 px-4 py-2 border rounded-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Filter Dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="all">All Routes</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
          </select>
          
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="distance">Distance (High to Low)</option>
          </select>
        </div>
        
        {/* Create Route Button */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          {showCreateForm ? 'Cancel' : 'Create New Route'}
        </button>
      </div>
      
      {/* Create Route Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create New Route</h2>
          
          <form onSubmit={handleCreateRoute}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Basic Info */}
              <div>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    name="title"
                    value={newRoute.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    value={newRoute.description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    rows="3"
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Distance (km)</label>
                    <input
                      type="number"
                      name="distance"
                      value={newRoute.distance}
                      onChange={handleInputChange}
                      min="0"
                      step="0.1"
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Elevation Gain (m)</label>
                    <input
                      type="number"
                      name="elevationGain"
                      value={newRoute.elevationGain}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Assign to User ID (optional)</label>
                  <input
                    type="text"
                    name="userId"
                    value={newRoute.userId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Leave blank to assign to yourself"
                  />
                </div>
                
                <div className="mb-3 flex space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="isPublic"
                      checked={newRoute.isPublic}
                      onChange={handleInputChange}
                      id="isPublic"
                      className="mr-2"
                    />
                    <label htmlFor="isPublic">Public Route</label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="isVerified"
                      checked={newRoute.isVerified}
                      onChange={handleInputChange}
                      id="isVerified"
                      className="mr-2"
                    />
                    <label htmlFor="isVerified">Verified Route</label>
                  </div>
                </div>
              </div>
              
              {/* Coordinates */}
              <div>
                <div className="mb-3">
                  <h3 className="text-lg font-medium mb-2">Start Point</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1">Longitude</label>
                      <input
                        type="number"
                        value={newRoute.startPoint.coordinates[0]}
                        onChange={(e) => handleCoordinateChange('start', 0, 0, e.target.value)}
                        step="0.0001"
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Latitude</label>
                      <input
                        type="number"
                        value={newRoute.startPoint.coordinates[1]}
                        onChange={(e) => handleCoordinateChange('start', 0, 1, e.target.value)}
                        step="0.0001"
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <h3 className="text-lg font-medium mb-2">End Point</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs mb-1">Longitude</label>
                      <input
                        type="number"
                        value={newRoute.endPoint.coordinates[0]}
                        onChange={(e) => handleCoordinateChange('end', 0, 0, e.target.value)}
                        step="0.0001"
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Latitude</label>
                      <input
                        type="number"
                        value={newRoute.endPoint.coordinates[1]}
                        onChange={(e) => handleCoordinateChange('end', 0, 1, e.target.value)}
                        step="0.0001"
                        className="w-full px-3 py-2 border rounded-md"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mb-3">
                  <h3 className="text-lg font-medium mb-2">
                    Path Coordinates
                    <button
                      type="button"
                      onClick={addPathCoordinate}
                      className="ml-2 text-sm bg-green-500 hover:bg-green-600 text-white px-2 py-0.5 rounded"
                    >
                      + Add Point
                    </button>
                  </h3>
                  
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2">
                    {newRoute.path.coordinates.length === 0 && (
                      <p className="text-gray-500 text-sm">No coordinates added yet</p>
                    )}
                    
                    {newRoute.path.coordinates.map((coord, index) => (
                      <div key={index} className="flex items-center mb-2">
                        <span className="text-xs font-medium w-6">{index + 1}.</span>
                        <div className="grid grid-cols-2 gap-2 flex-1">
                          <div>
                            <input
                              type="number"
                              value={coord[0]}
                              onChange={(e) => handleCoordinateChange('path', index, 0, e.target.value)}
                              placeholder="Longitude"
                              step="0.0001"
                              className="w-full px-2 py-1 border rounded-md text-sm"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={coord[1]}
                              onChange={(e) => handleCoordinateChange('path', index, 1, e.target.value)}
                              placeholder="Latitude"
                              step="0.0001"
                              className="w-full px-2 py-1 border rounded-md text-sm"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePathCoordinate(index)}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="mr-2 px-4 py-2 border rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Create Route
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Routes List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800 mb-2"></div>
            <p>Loading routes...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            <p>{error}</p>
            <button 
              onClick={fetchRoutes}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Try Again
            </button>
          </div>
        ) : sortedRoutes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No routes found</p>
            <button 
              onClick={fetchRoutes}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div>
            <div className="hidden md:grid grid-cols-12 gap-4 bg-gray-100 px-6 py-3 font-medium">
              <div className="col-span-3">Route</div>
              <div className="col-span-2">User</div>
              <div className="col-span-1">Distance</div>
              <div className="col-span-2">Created</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Actions</div>
            </div>
            
            {sortedRoutes.map(route => (
              <div 
                key={route._id}
                className={`border-t border-gray-200 px-6 py-4 ${selectedRoute === route._id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Route Info */}
                  <div className="md:col-span-3">
                    <h3 className="font-medium text-lg">{route.title || 'Unnamed Route'}</h3>
                    <p className="text-gray-500 text-sm line-clamp-1">{route.description || 'No description'}</p>
                    
                    {/* Show/hide details */}
                    <button 
                      onClick={() => setSelectedRoute(selectedRoute === route._id ? null : route._id)}
                      className="text-blue-600 hover:text-blue-800 text-sm mt-1"
                    >
                      {selectedRoute === route._id ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                  
                  {/* User */}
                  <div className="md:col-span-2">
                    <div className="text-sm">
                      {route.user ? (
                        <>
                          <span className="font-medium">
                            {route.user.firstName} {route.user.lastName}
                          </span>
                          <p className="text-gray-500">@{route.user.username}</p>
                        </>
                      ) : (
                        <span className="text-gray-500">Unknown user</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Distance */}
                  <div className="md:col-span-1">
                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                      {route.distance ? `${route.distance.toFixed(1)} km` : '?'}
                    </span>
                  </div>
                  
                  {/* Created Date */}
                  <div className="md:col-span-2">
                    <div className="text-sm">
                      {route.createdAt ? new Date(route.createdAt).toLocaleDateString() : 'Unknown date'}
                    </div>
                  </div>
                  
                  {/* Status */}
                  <div className="md:col-span-2">
                    {route.isVerified ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                        Verified
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                        Unverified
                      </span>
                    )}
                    {route.isPublic && (
                      <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        Public
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="md:col-span-2 flex gap-2">
                    {!route.isVerified && (
                      <button
                        onClick={() => handleVerifyRoute(route._id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Expanded details */}
                {selectedRoute === route._id && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Route Details</h4>
                        <p><span className="text-gray-500">Distance:</span> {route.distance ? `${route.distance.toFixed(1)} km` : 'Not specified'}</p>
                        <p><span className="text-gray-500">Elevation Gain:</span> {route.elevationGain ? `${route.elevationGain} m` : 'Not specified'}</p>
                        <p><span className="text-gray-500">Usage Count:</span> {route.usageCount || 0}</p>
                        <p><span className="text-gray-500">Created:</span> {route.createdAt ? new Date(route.createdAt).toLocaleString() : 'Unknown'}</p>
                        
                        {route.isVerified && (
                          <>
                            <p><span className="text-gray-500">Verified By:</span> {route.verifiedBy ? route.verifiedBy : 'Unknown'}</p>
                            <p><span className="text-gray-500">Verified Date:</span> {route.verificationDate ? new Date(route.verificationDate).toLocaleString() : 'Unknown'}</p>
                          </>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Route Preview</h4>
                        <RouteMiniMap route={route} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Pagination or Load More button could go here */}
            <div className="p-4 border-t border-gray-200 text-center">
              <button 
                onClick={fetchRoutes}
                className="px-4 py-2 border rounded-md hover:bg-gray-100"
              >
                Refresh Routes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRoutesPage;
