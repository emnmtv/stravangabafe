import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getUserRoutes, generateRoute, saveRoute, startSessionWithActivityType, stopSession, resetSession, SOCKET_URL, getNearbyRoutes, createRouteManually } from '../services/apiService';
import io from 'socket.io-client';

// Calculate distance between two points in kilometers
const calculateDistance = (point1, point2) => {
  const R = 6371; // Earth radius in km
  const dLat = (point2[0] - point1[0]) * Math.PI / 180;
  const dLon = (point2[1] - point1[1]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom flag markers for start and end points
const startIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #4CAF50; width: 12px; height: 12px; border-radius: 50%; position: relative; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4);">
          <div style="position: absolute; width: 30px; height: 20px; background-color: #4CAF50; left: 10px; top: -5px; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; box-shadow: 0 0 3px rgba(0,0,0,0.4);">
            START
          </div>
          <div style="position: absolute; width: 0; height: 0; border-style: solid; border-width: 0 0 15px 15px; border-color: transparent transparent #4CAF50 transparent; top: -15px; left: -2px; transform: rotate(45deg);"></div>
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
          <div style="position: absolute; width: 0; height: 0; border-style: solid; border-width: 0 0 15px 15px; border-color: transparent transparent #F44336 transparent; top: -15px; left: -2px; transform: rotate(45deg);"></div>
         </div>`,
  iconSize: [48, 42],
  iconAnchor: [6, 6]
});

// Component to store map reference
function MapController({ setMapRef, routeKey }) {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      console.log('MapController - Setting map reference, routeKey:', routeKey);
      
      // Set map reference safely after the map is fully initialized
      const timer = setTimeout(() => {
        try {
          // Check if the map is still valid before setting the reference
          if (map && !map._isDestroyed && map._container && map._loaded) {
        setMapRef(map);
        
            // Safe map invalidation with robust error handling
            if (typeof map.invalidateSize === 'function') {
            map.invalidateSize(true);
            }
          }
        } catch (e) {
          console.error('Error setting map reference:', e);
        }
      }, 300);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [map, setMapRef, routeKey]);
  
  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Clean up map reference on unmount
      setMapRef(null);
    };
  }, [setMapRef]);
  
  return null;
}

// Component to handle route display on map - optimized for performance
function RouteDisplay({ route, currentPosition, isTracking }) {
  const map = useMap();
  const [completedPath, setCompletedPath] = useState([]);
  const [remainingPath, setRemainingPath] = useState([]);
  const completedRef = useRef([]);
  const remainingRef = useRef([]);
  const autoCompletedRef = useRef(false);
  
  // Initialize route paths
  useEffect(() => {
    if (route && route.pathCoordinates && route.pathCoordinates.length > 1) {
      setRemainingPath(route.pathCoordinates);
      setCompletedPath([]);
      completedRef.current = [];
      remainingRef.current = route.pathCoordinates;
    }
  }, [route]);
  
  // Update path segments based on current position when tracking
  useEffect(() => {
    if (!isTracking || !currentPosition || !route || !route.pathCoordinates || route.pathCoordinates.length < 2) {
      return;
    }
    
    const pathCoords = route.pathCoordinates;
    const userPos = currentPosition;
    
    // Find closest point on route to current position
    let closestPointIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < pathCoords.length; i++) {
      const pointOnPath = pathCoords[i];
      // Use the globally defined calculateDistance function
      const distance = calculateDistance([userPos[0], userPos[1]], [pointOnPath[0], pointOnPath[1]]);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPointIndex = i;
      }
    }
    
    // Consider the route "eaten" up to this point if we're close enough to the route
    if (minDistance < 0.05) { // 50 meters threshold
      const newCompletedPath = pathCoords.slice(0, closestPointIndex + 1);
      const newRemainingPath = pathCoords.slice(closestPointIndex);
      
      // Only update if there's a significant change (at least one new point completed)
      if (newCompletedPath.length > completedRef.current.length) {
        console.log(`User progressed to path point ${closestPointIndex}/${pathCoords.length}`);
        setCompletedPath(newCompletedPath);
        setRemainingPath(newRemainingPath);
        completedRef.current = newCompletedPath;
        remainingRef.current = newRemainingPath;
        
        // Auto-detect route completion - if very close to endpoint or we've completed 95% of the route
        if (!autoCompletedRef.current && 
            ((closestPointIndex >= pathCoords.length - 3) || 
             (closestPointIndex / pathCoords.length > 0.95))) {
          
          // Only trigger once
          if (!autoCompletedRef.current) {
            autoCompletedRef.current = true;
            
            // Dispatch custom event for route completion
            window.dispatchEvent(new CustomEvent('routeCompleted', { 
              detail: { 
                route,
                progress: (closestPointIndex / pathCoords.length) * 100
              }
            }));
          }
        }
      }
    }
  }, [isTracking, currentPosition, route]);
  
  useEffect(() => {
    if (route && route.pathCoordinates && route.pathCoordinates.length > 1 && map) {
      // Wait for map to be ready
      const timer = setTimeout(() => {
        try {
          if (map._container && map._loaded) {
        const bounds = L.latLngBounds(route.pathCoordinates);
            if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
          }
          }
      } catch (error) {
          // Fallback to start point on error
          if (route.startPoint && map._container && map._loaded) {
            map.setView(route.startPoint, 14);
          }
        }
        
        // Ensure map is properly sized
        if (typeof map.invalidateSize === 'function') {
          map.invalidateSize(true);
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [route, map]);
  
  if (!route || !route.pathCoordinates || route.pathCoordinates.length < 2) {
    return null;
  }
  
  // Limit the number of waypoint markers to avoid lag
  const waypointLimit = 5;
  let waypointCoordinates = [];
  
  if (route.pathCoordinates.length > 2) {
    const middlePoints = route.pathCoordinates.slice(1, -1);
    
    // If too many points, only show a limited number distributed evenly
    if (middlePoints.length > waypointLimit) {
      const step = Math.floor(middlePoints.length / waypointLimit);
      for (let i = 0; i < middlePoints.length; i += step) {
        if (waypointCoordinates.length < waypointLimit) {
          waypointCoordinates.push({
            position: middlePoints[i],
            index: i + 1
          });
        }
      }
    } else {
      // If not too many, show all waypoints
      waypointCoordinates = middlePoints.map((coord, index) => ({
        position: coord,
        index: index + 1
      }));
    }
  }
  
  return (
    <>
      {/* Completed path in green - thicker and more visible */}
      {isTracking && completedPath.length > 1 && (
      <Polyline 
          key={`completed-${route._id || 'current'}`}
          positions={completedPath}
        color="#4CAF50"
          weight={7}
          opacity={0.9}
          // Ensure polyline is fully rendered by setting bubblingMouseEvents to false
          bubblingMouseEvents={false}
          // Add a slight buffer to prevent edge clipping
          lineCap="round"
          lineJoin="round"
        />
      )}
      
      {/* Remaining path in purple with animation effect */}
      <Polyline 
        key={`remaining-${route._id || 'current'}`}
        positions={isTracking ? remainingPath : route.pathCoordinates}
        color={isTracking ? "#8E24AA" : "#8E24AA"} /* Always purple for route to follow */
        weight={5}
        opacity={0.7}
        className="leaflet-interactive"
        dashArray="10, 10"
        dashOffset="0"
        // Improve rendering and interaction
        bubblingMouseEvents={false}
        lineCap="round"
        lineJoin="round"
        eventHandlers={{
          click: () => {
            // Reopen the route info panel when clicking on the route
            window.dispatchEvent(new CustomEvent('showRouteInfo', { detail: route }));
          }
        }}
      >
        <Popup className="route-popup">
          <div>
            <strong>{route.title || 'Unnamed Route'}</strong>
            <div>Distance: {route.distance || '?'} km</div>
            <div>Points: {route.pathCoordinates.length}</div>
            <button 
              className="mt-2 py-1 px-2 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
              onClick={(e) => {
                // Prevent the popup from closing
                e.stopPropagation();
                // Manually trigger showing route info
                window.dispatchEvent(new CustomEvent('showRouteInfo', { detail: route }));
              }}
            >
              Show Details
            </button>
          </div>
        </Popup>
      </Polyline>
      
      {/* Start marker */}
      <Marker 
        key={`start-${route._id || 'current'}`} 
        position={route.startPoint} 
        icon={startIcon}
      >
        <Popup>Start: {route.title || 'Unnamed Route'}</Popup>
      </Marker>
      
      {/* End marker - only if different from start */}
      {(route.endPoint[0] !== route.startPoint[0] || route.endPoint[1] !== route.startPoint[1]) && (
      <Marker 
          key={`end-${route._id || 'current'}`} 
        position={route.endPoint} 
        icon={endIcon}
      >
        <Popup>End: {route.title || 'Unnamed Route'}</Popup>
      </Marker>
      )}
      
      {/* Limited waypoint markers to improve performance */}
      {waypointCoordinates.map(({ position, index }) => (
        <Marker
          key={`waypoint-${index}-${route._id || 'current'}`}
          position={position}
          icon={L.divIcon({
            className: 'waypoint-marker',
            html: `<div style="background-color: #3388ff; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 2px solid white;">${index}</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })}
        >
          <Popup>Waypoint {index}</Popup>
        </Marker>
      ))}
    </>
  );
}

// Olongapo City coordinates
const OLONGAPO_COORDINATES = [14.8386, 120.2842];

// Add this component for route mini maps
const RouteMiniMap = ({ route }) => {
  const mapRef = useRef(null);
  
  // Calculate bounds
  const calculateBounds = () => {
    if (!route || !route.pathCoordinates || route.pathCoordinates.length < 2) {
      return L.latLngBounds(OLONGAPO_COORDINATES, OLONGAPO_COORDINATES);
    }
    return L.latLngBounds(route.pathCoordinates);
  };
  
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      
      // Properly invalidate size for correct rendering
      setTimeout(() => {
        try {
          map.invalidateSize();
          
          // Set bounds
          const bounds = calculateBounds();
          map.fitBounds(bounds, { padding: [5, 5] });
        } catch (e) {
          console.error("Error setting mini map bounds:", e);
        }
      }, 100);
    }
  }, [route]);
  
  if (!route || !route.pathCoordinates || route.pathCoordinates.length < 2) {
    return <div className="h-28 w-full bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">No path data</div>;
  }
  
  return (
    <div className="h-28 w-full rounded overflow-hidden">
      <MapContainer
        bounds={calculateBounds()}
        ref={mapRef}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        boxZoom={false}
        keyboard={false}
        minZoom={10}
        maxZoom={18}
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
          lineCap="round"
          lineJoin="round"
        />
        
        {/* Start marker */}
        <Marker 
          position={route.startPoint} 
          icon={new L.DivIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #4CAF50; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [8, 8],
            iconAnchor: [4, 4]
          })}
        />
        
        {/* End marker */}
        <Marker 
          position={route.endPoint} 
          icon={new L.DivIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #F44336; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [8, 8],
            iconAnchor: [4, 4]
          })}
        />
      </MapContainer>
    </div>
  );
};

// Add the ManualRoutePreview component
function ManualRoutePreview({ manualRoute }) {
  const startCoords = manualRoute.startPoint.coordinates;
  const endCoords = manualRoute.endPoint.coordinates;
  const pathCoords = manualRoute.path.coordinates;
  
  // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
  const startPoint = startCoords[0] !== 0 && startCoords[1] !== 0 ? [startCoords[1], startCoords[0]] : null;
  const endPoint = endCoords[0] !== 0 && endCoords[1] !== 0 ? [endCoords[1], endCoords[0]] : null;
  
  // Convert path coordinates from [lng, lat] to [lat, lng]
  const pathPoints = pathCoords.length > 0 
    ? pathCoords.map(coord => [coord[1], coord[0]]) 
    : [];
  
  // Create full route path combining start, waypoints, and end
  const fullPath = [];
  if (startPoint) fullPath.push(startPoint);
  fullPath.push(...pathPoints);
  if (endPoint && (pathPoints.length === 0 || 
      endPoint[0] !== pathPoints[pathPoints.length-1][0] || 
      endPoint[1] !== pathPoints[pathPoints.length-1][1])) {
    fullPath.push(endPoint);
  }
  
  // Define marker icons for start/end points with improved visibility
  const startMarkerIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: `
      <div style="position: relative;">
        <div style="background-color: #4CAF50; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 12px; font-weight: bold;">S</span>
        </div>
        <div style="position: absolute; bottom: -15px; left: 50%; transform: translateX(-50%); background-color: #4CAF50; color: white; border-radius: 2px; padding: 2px 4px; font-size: 8px; white-space: nowrap;">START</div>
      </div>`,
    iconSize: [24, 38],
    iconAnchor: [12, 12]
  });
  
  const endMarkerIcon = new L.DivIcon({
    className: 'custom-div-icon',
    html: `
      <div style="position: relative;">
        <div style="background-color: #F44336; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 12px; font-weight: bold;">F</span>
        </div>
        <div style="position: absolute; bottom: -15px; left: 50%; transform: translateX(-50%); background-color: #F44336; color: white; border-radius: 2px; padding: 2px 4px; font-size: 8px; white-space: nowrap;">FINISH</div>
      </div>`,
    iconSize: [24, 38],
    iconAnchor: [12, 12]
  });
  
  // Create numbered waypoint icons
  const createWaypointIcon = (index) => {
    return new L.DivIcon({
      className: 'custom-div-icon',
      html: `
        <div style="position: relative;">
          <div style="background-color: #3388ff; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 10px; font-weight: bold;">${index + 1}</span>
          </div>
        </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };
  
  // Only render if we have at least one valid coordinate
  if (fullPath.length < 1) {
    return null;
  }
  
  return (
    <>
      {fullPath.length > 1 && (
        <Polyline
          positions={fullPath}
          color="#8E24AA"
          weight={4}
          opacity={0.7}
          dashArray="8,8"
        />
      )}
      
      {startPoint && (
        <Marker position={startPoint} icon={startMarkerIcon}>
          <Popup>Start Point</Popup>
        </Marker>
      )}
      
      {endPoint && (
        <Marker position={endPoint} icon={endMarkerIcon}>
          <Popup>End Point</Popup>
        </Marker>
      )}
      
      {pathPoints.map((point, index) => (
        <Marker 
          key={`waypoint-${index}`} 
          position={point}
          icon={createWaypointIcon(index)}
        >
          <Popup>Waypoint {index + 1}</Popup>
        </Marker>
      ))}
    </>
  );
}

function Home() {
  const [currentPosition, setCurrentPosition] = useState(OLONGAPO_COORDINATES);
  const [userRoutes, setUserRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [mapKey, setMapKey] = useState(Date.now()); // For forcing map re-renders
  
  // Add activity type state
  const [activityType, setActivityType] = useState('run');
  
  // Remove isLiveTracking as tracking is now integrated
  // [isLiveTracking removed]
  const [trackingPath, setTrackingPath] = useState([]);
  const locationWatchId = useRef(null);
  const socketRef = useRef(null);
  const [trackingStats, setTrackingStats] = useState({
    distance: 0,
    duration: 0,
    speed: 0,
    startTime: null
  });
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const timerRef = useRef(null);
  const locationUpdateTimerRef = useRef(null);
  
  // UI control states
  const [showRoutesList, setShowRoutesList] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showRouteInfo, setShowRouteInfo] = useState(false);
  const [isPinningLocation, setIsPinningLocation] = useState(false);
  const [routeListTab, setRouteListTab] = useState('all'); // For routes list filtering (all/completed)
  
  // Add route pin mode for map click to add route points
  const [isRoutePinMode, setIsRoutePinMode] = useState(false);
  const [routePinType, setRoutePinType] = useState(null); // 'start', 'end', or 'path'
  const [isConnectWaypoints, setIsConnectWaypoints] = useState(true); // Auto-connect waypoints along roads
  
  // Route generation states
  const [routeType, setRouteType] = useState('short');
  const [maxDistance, setMaxDistance] = useState(5);
  const [generatingRoute, setGeneratingRoute] = useState(false);
  
  // Tracking state
  const [isTracking, setIsTracking] = useState(false);
  const mapContainerRef = useRef(null);

  // Persistent references for timer and tracking
  const trackingStartTimeRef = useRef(null); // Persistent reference for start time
  const timerIntervalRef = useRef(null); // Persistent reference to timer interval
  const trackingStatsRef = useRef({
    distance: 0,
    duration: 0,
    speed: 0,
    startTime: null,
    lastSyncTime: null
  }); // Persistent reference for tracking stats
  
  // Simulation state
  // eslint-disable-next-line no-unused-vars
  const [isSimulating, setIsSimulating] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [simulationStep, setSimulationStep] = useState(0);
  const simulationIntervalRef = useRef(null);
  const currentSimulationStepRef = useRef(0); // Reference to track current step without re-renders
  const isSimulatingRef = useRef(false); // Ref to track simulation state without re-renders
  const selectedRouteRef = useRef(null); // Ref to keep route data stable during simulation
  const [simulationSpeed, setSimulationSpeed] = useState(1); // Speed multiplier

  // Add new state variable for auto-completed state
  const [isAutoCompleted, setIsAutoCompleted] = useState(false);

  // Add a state variable to store nearby routes (around line 437)
  const [nearbyRoutes, setNearbyRoutes] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // Manual route creation state
  const [showManualCreateForm, setShowManualCreateForm] = useState(false);
  const [manualRoute, setManualRoute] = useState({
    title: '',
    description: '',
    distance: 0,
    elevationGain: 0,
    isPublic: true,
    startPoint: {
      type: 'Point',
      coordinates: [0, 0] // [longitude, latitude]
    },
    endPoint: {
      type: 'Point',
      coordinates: [0, 0]
    },
    path: {
      type: 'LineString',
      coordinates: [] // Array of [longitude, latitude] points
    }
  });
  
  // Reset manual route with current location as start point
  const initializeManualRoute = () => {
    if (currentPosition) {
      setManualRoute({
        title: `Route ${new Date().toLocaleDateString()}`,
        description: '',
        distance: 0,
        elevationGain: 0,
        isPublic: true,
        startPoint: {
          type: 'Point',
          coordinates: [currentPosition[1], currentPosition[0]] // [lng, lat]
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
    }
  };



  // Function to fetch nearby routes using the user's current location
  const fetchNearbyRoutes = async () => {
    if (!currentPosition) {
      alert('Unable to determine your current location. Please enable location services and try again.');
      setLoadingNearby(false);
      return;
    }
    
    try {
      setLoadingNearby(true);
      console.log('Fetching nearby routes from position:', currentPosition);
      
      // Get the user's current location for nearby search
      const response = await getNearbyRoutes({
        latitude: currentPosition[0],
        longitude: currentPosition[1],
        maxDistance: 5 // Reduced to 5km to only show truly nearby routes
      });
      
      if (response.success) {
        console.log('Nearby routes found:', response.data.length);
        
        // Process routes to add Leaflet-compatible coordinates
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
                // Silent error handling for performance
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
            // Silent error handling for performance
          }
          
          // Process start point
          if (route.startPoint) {
            try {
              let startPointData = route.startPoint;
              
              if (typeof startPointData === 'string') {
                try {
                  startPointData = JSON.parse(startPointData);
                } catch(e) {
                  // Silent error handling
                }
              }
              
              if (startPointData.coordinates && Array.isArray(startPointData.coordinates) && startPointData.coordinates.length >= 2) {
                startPoint = [startPointData.coordinates[1], startPointData.coordinates[0]];
              }
            } catch (e) {
              // Silent error handling
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
                  // Silent error handling
                }
              }
              
              if (endPointData.coordinates && Array.isArray(endPointData.coordinates) && endPointData.coordinates.length >= 2) {
                endPoint = [endPointData.coordinates[1], endPointData.coordinates[0]];
              }
            } catch (e) {
              // Silent error handling
            }
          }
          
          return {
            ...route,
            pathCoordinates,
            startPoint,
            endPoint
          };
        });
        
        setNearbyRoutes(processedRoutes);
      } else {
        console.error('Failed to fetch nearby routes:', response.message);
      }
    } catch (err) {
      console.error('Error fetching nearby routes:', err);
    } finally {
      setLoadingNearby(false);
    }
  };

  // Update the effect that runs when routeListTab changes (add after the useEffect that fetches routes)
  useEffect(() => {
    if (routeListTab === 'nearby') {
      fetchNearbyRoutes();
    }
  }, [routeListTab, currentPosition]);
  
  // Add event listener for route completion
  useEffect(() => {
    const handleRouteCompleted = (event) => {
      if (isTracking && !isAutoCompleted) {
        console.log("Route auto-completed:", event.detail.progress.toFixed(1) + "%");
        
        // Stop the timer but keep tracking state
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // If using location tracking, stop watching position
        if (locationWatchId.current !== null) {
          try {
            navigator.geolocation.clearWatch(locationWatchId.current);
          } catch (e) {
            console.error("Error clearing location watch:", e);
          }
          locationWatchId.current = null;
        }
        
        // Set auto-completed state
        setIsAutoCompleted(true);
        
        // Show notification to the user
        alert('Route completed! You can mark it as done to save your progress.');
      }
    };
    
    window.addEventListener('routeCompleted', handleRouteCompleted);
    
    return () => {
      window.removeEventListener('routeCompleted', handleRouteCompleted);
    };
  }, [isTracking, isAutoCompleted]);
  
  // Reset auto-completed state when starting new tracking session
  useEffect(() => {
    if (!isTracking) {
      setIsAutoCompleted(false);
    }
  }, [isTracking]);
  
  // Function to handle "Mark as Done" button
  const handleMarkAsDone = () => {
    // Store tracking data before clearing state
    const trackingData = {
      path: [...trackingPath],
      distance: trackingStats.distance,
      duration: trackingStats.duration,
      speed: trackingStats.speed,
      startTime: trackingStats.startTime
    };
    
    // Set tracking to false
    setIsTracking(false);
    setIsAutoCompleted(false);
    
    // Only offer to save if we have enough data
    if (trackingPath.length >= 3 && trackingStats.distance > 0.01) {
      setTimeout(() => {
        // Ask if user wants to save the tracked path
        if (window.confirm('Would you like to save this tracked route?')) {
          try {
            // Create a title with timestamp to ensure uniqueness
            const routeTitle = prompt(
              'Enter a name for this completed route:', 
              `Completed ${selectedRoute ? selectedRoute.title : 'Route'} - ${new Date().toLocaleTimeString()}`
            );
            
            if (!routeTitle) {
              console.log("Route save cancelled by user");
              // Reset tracking stats and path even if user cancels
              setTrackingStats({
                distance: 0,
                duration: 0,
                speed: 0,
                startTime: null
              });
              setElapsedTime('00:00:00');
              setTrackingPath([]);
              return;
            }
            
            // Ensure we have a valid distance (at least 0.01)
            const routeDistance = Math.max(0.01, trackingData.distance);
            
            // Get start, mid, and end points to ensure at least 3 points in path
            const firstPoint = trackingData.path[0];
            const lastPoint = trackingData.path[trackingData.path.length - 1];
            
            // Validate that points have valid coordinates
            if (!Array.isArray(firstPoint) || firstPoint.length < 2 || 
                !Array.isArray(lastPoint) || lastPoint.length < 2) {
              alert('Error: Invalid coordinates in tracking data');
              return;
            }
            
            // Create a simplified path if too many points
            let pathToUse = trackingData.path;
            if (trackingData.path.length > 100) {
              // Simplify by taking every nth point to keep under 100 points
              const step = Math.ceil(trackingData.path.length / 100);
              pathToUse = trackingData.path.filter((_, index) => index % step === 0 || index === trackingData.path.length - 1);
              
              // Always ensure we keep first and last point
              if (!pathToUse.includes(firstPoint)) pathToUse.unshift(firstPoint);
              if (!pathToUse.includes(lastPoint)) pathToUse.push(lastPoint);
            }
            
            // Format path coordinates correctly for GeoJSON
            const pathCoordinates = pathToUse.map(point => {
              if (!Array.isArray(point) || point.length < 2 || 
                  isNaN(point[0]) || isNaN(point[1])) {
                console.warn('Skipping invalid point:', point);
                return null;
              }
              
              // Convert from [latitude, longitude] to [longitude, latitude]
              return [point[1], point[0]];
            }).filter(point => point !== null);
            
            // Ensure we still have enough valid points after filtering
            if (pathCoordinates.length < 3) {
              alert('Error: Not enough valid coordinates in path. Need at least 3 points.');
              return;
            }
            
            // Create route data with all required fields
            const routeData = {
              title: routeTitle,
              description: `Route completed on ${new Date().toLocaleDateString()}`,
              distance: routeDistance,
              elevationGain: 0,
              path: {
                type: 'LineString',
                coordinates: pathCoordinates
              },
              startPoint: {
                type: 'Point',
                coordinates: [firstPoint[1], firstPoint[0]]
              },
              endPoint: {
                type: 'Point',
                coordinates: [lastPoint[1], lastPoint[0]]
              },
              completed: true // Automatically mark as completed
            };
            
            // Get token and save the route
            const token = localStorage.getItem('token');
            if (!token) {
              alert('Error: You must be logged in to save routes');
              return;
            }
            
            saveRoute(token, routeData)
              .then(result => {
                if (result.success) {
                  alert('Route saved successfully!');
                  // Refresh routes list
                  fetchRoutes();
                  
                  // Ask if the user also wants to save as an activity
                  const saveAsActivity = window.confirm(
                    'Do you also want to save this as an activity? Click OK for activity, Cancel for route only.'
                  );
                  
                  if (saveAsActivity) {
                    // Save as activity
                    saveTrackedRouteAsActivity(trackingData, routeTitle);
                  }
                } else {
                  alert('Failed to save route: ' + (result.message || 'Unknown server error'));
                  console.error('Route save failed:', result);
                }
              })
              .catch(err => {
                console.error('Error saving route:', err);
                alert('Error saving route: ' + (err.message || 'Unknown error occurred'));
              });
          } catch (error) {
            console.error('Error preparing route data:', error);
            alert('Error preparing route data: ' + error.message);
          }
        }
        
        // Reset tracking stats after saving (or not saving)
        setTrackingStats({
          distance: 0,
          duration: 0,
          speed: 0,
          startTime: null
        });
        setElapsedTime('00:00:00');
        setTrackingPath([]);
      }, 500);
    } else {
      alert('Not enough tracking data to save. You need to move more to create a valid route.');
      
      // Reset tracking stats and path
      setTrackingStats({
        distance: 0,
        duration: 0,
        speed: 0,
        startTime: null
      });
      setElapsedTime('00:00:00');
      setTrackingPath([]);
    }
  };
  
  // Add an event listener to handle reopening the route info panel
  useEffect(() => {
    const handleShowRouteInfo = (event) => {
      // If it's the currently selected route, just show the info panel
      if (event.detail && event.detail._id === selectedRoute?._id) {
        setShowRouteInfo(true);
      } 
      // If it's a different route, select it and show the info panel
      else if (event.detail) {
        setSelectedRoute(event.detail);
        setShowRouteInfo(true);
      }
    };
    
    window.addEventListener('showRouteInfo', handleShowRouteInfo);
    
    return () => {
      window.removeEventListener('showRouteInfo', handleShowRouteInfo);
    };
  }, [selectedRoute]);

  // Function to update user's current location
  // eslint-disable-next-line no-unused-vars
  const updateCurrentLocation = () => {
    if (navigator.geolocation && !isTracking) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition = [
            position.coords.latitude,
            position.coords.longitude
          ];
          // Only update if position has changed significantly
          if (calculateDistance(currentPosition, newPosition) > 0.005) { // >5 meters
            console.log('Updating user location:', newPosition);
            setCurrentPosition(newPosition);
          }
        },
        (err) => {
          console.error('Error updating location:', err);
          // Don't show alerts for silent background updates
          if (err.code === 3) { // Timeout
            console.log('Location update timed out, will try again later');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Set up periodic location updates when not actively tracking
  useEffect(() => {
    // Only set up periodic updates when not in tracking mode
    if (!isTracking && !locationUpdateTimerRef.current) {
      // Update location every 15 seconds
      locationUpdateTimerRef.current = setInterval(() => {
        updateCurrentLocation();
        
        // Also update the server with our current location if connected
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('update_location', {
            userId: localStorage.getItem('userId'),
            position: currentPosition,
            timestamp: Date.now()
          });
        }
      }, 15000);
    }
    
    // Clean up interval when component unmounts or when tracking starts
    return () => {
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
        locationUpdateTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, currentPosition]);

  // Get user's current location
  useEffect(() => {
    let locationAttempts = 0;
    
    const tryGetLocation = () => {
      locationAttempts++;
      
      if (locationAttempts > 1) {
        console.log(`Initial location attempt ${locationAttempts}...`);
      }
      
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = [
            position.coords.latitude,
            position.coords.longitude
          ];
          console.log('Got user location:', userLocation);
          setCurrentPosition(userLocation);
          
          // Focus map on user location when available
          if (mapRef) {
            setTimeout(() => {
              try {
                mapRef.setView(userLocation, 14);
                console.log('Focused map on user location');
              } catch (e) {
                console.error('Error focusing map on user location:', e);
              }
            }, 500);
          }
          
          // Send initial location to server (doesn't start tracking yet)
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('update_location', {
              userId: localStorage.getItem('userId'),
              position: userLocation,
              timestamp: Date.now()
            });
          }
        },
        (err) => {
          console.error('Error getting location:', err);
            
            if (err.code === 3 && locationAttempts < 3) { // Timeout error, try again
              console.log("Location timed out, retrying...");
              setTimeout(tryGetLocation, 1000);
              return;
            }
            
            // Default to Olongapo City coordinates if location access denied or timed out repeatedly
          setCurrentPosition(OLONGAPO_COORDINATES);
            console.log('Using default location after error');
          },
          { 
            enableHighAccuracy: true, 
            timeout: 10000, 
            maximumAge: 0 
          }
      );
    } else {
      setCurrentPosition(OLONGAPO_COORDINATES); // Default to Olongapo City
    }
    };
    
    tryGetLocation();
  }, [mapRef]); // Add mapRef as dependency to update focus when map is ready

  // Fetch user's routes - optimized version with less logging
  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await getUserRoutes(token);
      
      if (response.success) {
        // Transform the GeoJSON coordinates to Leaflet format [lat, lng]
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
                // Silent error handling for performance
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
            // Silent error handling for performance
          }
          
          // Process start point
          if (route.startPoint) {
            try {
              let startPointData = route.startPoint;
              
              if (typeof startPointData === 'string') {
                try {
                  startPointData = JSON.parse(startPointData);
                } catch(e) {
                  // Silent error handling
                }
              }
              
              if (startPointData.coordinates && Array.isArray(startPointData.coordinates) && startPointData.coordinates.length >= 2) {
                startPoint = [startPointData.coordinates[1], startPointData.coordinates[0]];
              }
            } catch (e) {
              // Silent error handling
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
                  // Silent error handling
                }
              }
              
              if (endPointData.coordinates && Array.isArray(endPointData.coordinates) && endPointData.coordinates.length >= 2) {
                endPoint = [endPointData.coordinates[1], endPointData.coordinates[0]];
              }
            } catch (e) {
              // Silent error handling
            }
          }
          
          // If we still don't have path coordinates but have start and end, create a simple path
          if (pathCoordinates.length < 2) {
            pathCoordinates = [startPoint, endPoint];
          }
          
          return {
            ...route,
            pathCoordinates,
            startPoint,
            endPoint
          };
        });
        
        // Log completed routes for debugging
        console.log('Completed routes:', processedRoutes.filter(r => r.completed).length, 'of', processedRoutes.length);
        
        setUserRoutes(processedRoutes);
        
        // Don't automatically select a route on login - just store the routes
        // If you want to show a route list or notification instead, you can add that here
      } else {
        setError(response.message || 'Failed to fetch routes');
      }
    } catch (err) {
      setError('An error occurred while fetching your routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safely set map view with error handling
  const safeSetMapView = (map, position, zoom = 14) => {
    if (!map) return false;
    
    try {
      // First make sure the map container is ready
      if (map._container && map._loaded && map._mapPane && map._mapPane._leaflet_pos) {
        console.log('Setting map view to:', position);
        map.setView(position, zoom);
        return true;
      } else {
        console.warn('Map not ready for setView - container or loaded state issue');
        return false;
      }
    } catch (e) {
      console.error('Error setting map view:', e);
      return false;
    }
  };

  // Safe bounds fitting with error handling
  const safeFitBounds = (map, bounds, options = { padding: [50, 50] }) => {
    if (!map) return false;
    
    try {
      // Check if map and bounds are valid
      if (map._container && map._loaded && map._mapPane && map._mapPane._leaflet_pos && bounds && bounds.isValid()) {
        console.log('Fitting map to bounds');
        map.fitBounds(bounds, options);
        return true;
      } else {
        console.warn('Map or bounds not ready for fitBounds');
        return false;
      }
    } catch (e) {
      console.error('Error fitting bounds:', e);
      return false;
    }
  };

  // Handle route selection
  const handleRouteSelect = (route) => {
    console.log('Route selected:', route.title, 'ID:', route._id);
    console.log('Route coordinates count:', route.pathCoordinates ? route.pathCoordinates.length : 0);
    console.log('Start point:', route.startPoint);
    console.log('End point:', route.endPoint);
    
    if (!route.pathCoordinates || route.pathCoordinates.length < 2) {
      console.warn('Selected route has insufficient coordinates, attempting to fix...');
      
      // Try to rebuild the path from raw data
      try {
        if (route.path) {
          const pathData = typeof route.path === 'string' 
            ? JSON.parse(route.path) 
            : route.path;
          
          if (pathData.coordinates && Array.isArray(pathData.coordinates)) {
            route.pathCoordinates = pathData.coordinates.map(coord => 
              Array.isArray(coord) && coord.length >= 2 
                ? [coord[1], coord[0]] 
                : OLONGAPO_COORDINATES
            );
            console.log('Rebuilt path coordinates:', route.pathCoordinates.length);
          }
        }
      } catch (e) {
        console.error('Error rebuilding path:', e);
      }
      
      // If still insufficient, create a simple path
      if (!route.pathCoordinates || route.pathCoordinates.length < 2) {
        console.warn('Creating fallback path between start and end points');
        route.pathCoordinates = [route.startPoint, route.endPoint];
      }
    }
    
    setSelectedRoute(route);
    setShowRoutesList(false);
    setShowRouteInfo(true);
    
    // Force map redraw to ensure route is displayed
    setMapKey(Date.now());
    
    // Additional step: center map on route ONLY after we're sure the map is ready
    if (mapRef) {
      // First try to just center on the start point as a safe operation
      safeSetMapView(mapRef, route.startPoint, 14);
      
      // Then try to fit bounds after a delay to ensure map is ready
      setTimeout(() => {
        if (mapRef && route.pathCoordinates && route.pathCoordinates.length > 0) {
          try {
            const bounds = L.latLngBounds(route.pathCoordinates);
            safeFitBounds(mapRef, bounds);
          } catch (e) {
            console.error('Error creating bounds for route:', e);
          }
        }
      }, 500);
    }
  };
  
  // Handle route generation
  const handleGenerateRoute = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first to generate routes');
      return;
    }
    
    setGeneratingRoute(true);
    try {
      const result = await generateRoute(token, {
        latitude: currentPosition[0],
        longitude: currentPosition[1],
        type: routeType,
        maxDistance: parseFloat(maxDistance)
      });
      
      console.log('Generate route result:', result);
      
      if (result.success && result.data) {
        // Process the newly generated route
        const generatedRoute = result.data;
        
        // Process path coordinates
        let pathCoordinates = [];
        let startPoint = currentPosition;
        let endPoint = currentPosition;
        
        if (generatedRoute.path) {
          pathCoordinates = parseCoordinates(generatedRoute.path);
        }
        
        if (generatedRoute.startPoint && generatedRoute.startPoint.coordinates) {
          startPoint = [
            generatedRoute.startPoint.coordinates[1], 
            generatedRoute.startPoint.coordinates[0]
          ];
        }
        
        if (generatedRoute.endPoint && generatedRoute.endPoint.coordinates) {
          endPoint = [
            generatedRoute.endPoint.coordinates[1], 
            generatedRoute.endPoint.coordinates[0]
          ];
        }
        
        // Ensure we have valid data
        if (pathCoordinates.length < 2) {
          // Generate a simple route if API failed to provide one
          console.warn('Generated route had insufficient coordinates, creating fallback');
          pathCoordinates = createFallbackRoute(startPoint, 5);
          endPoint = pathCoordinates[pathCoordinates.length - 1];
        }
        
        const processedRoute = {
          ...generatedRoute,
          _id: 'generated-' + Date.now(),
          pathCoordinates,
          startPoint,
          endPoint
        };
        
        setSelectedRoute(processedRoute);
        setShowGenerateForm(false);
        setShowRouteInfo(true);
        
        // Force map redraw to ensure route is displayed
        setMapKey(Date.now());
      } else {
        alert('Failed to generate route: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error generating route:', err);
      alert('Error generating route: ' + err.message);
    } finally {
      setGeneratingRoute(false);
    }
  };
  
  // Helper function to create a fallback route if API fails
  const createFallbackRoute = (startPoint, distance = 3) => {
    const points = [startPoint];
    const R = 6371; // Earth radius in km
    const numPoints = 8;
    
    let lastPoint = startPoint;
    for (let i = 1; i < numPoints; i++) {
      // Generate next point in random direction
      const angle = (i / numPoints) * 2 * Math.PI; // Create a circular route
      const stepDistance = distance / numPoints;
      
      // Convert km to radians
      const angularDistance = stepDistance / R;
      
      // Previous point
      const [lat, lng] = lastPoint;
      const prevLat = lat * Math.PI / 180;
      const prevLng = lng * Math.PI / 180;
      
      // Calculate new position
      const newLat = Math.asin(
        Math.sin(prevLat) * Math.cos(angularDistance) +
        Math.cos(prevLat) * Math.sin(angularDistance) * Math.cos(angle)
      );
      
      const newLng = prevLng + Math.atan2(
        Math.sin(angle) * Math.sin(angularDistance) * Math.cos(prevLat),
        Math.cos(angularDistance) - Math.sin(prevLat) * Math.sin(newLat)
      );
      
      // Convert to degrees and add to points
      const newPoint = [
        newLat * 180 / Math.PI,
        newLng * 180 / Math.PI
      ];
      
      points.push(newPoint);
      lastPoint = newPoint;
    }
    
    // Close the loop by returning to start
    points.push(startPoint);
    
    return points;
  };
  
  // Toggle tracking state
  const toggleTracking = () => {
    if (isTracking) {
      // Stop tracking
      if (window.confirm('Are you sure you want to stop tracking?')) {
        // Store tracking data before clearing state
        const trackingData = {
          path: [...trackingPath],
          distance: trackingStats.distance,
          duration: trackingStats.duration,
          speed: trackingStats.speed,
          startTime: trackingStats.startTime
        };
        
        // Clear tracking timers
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // Stop location watching safely
        if (locationWatchId.current !== null) {
          try {
            navigator.geolocation.clearWatch(locationWatchId.current);
          } catch (e) {
            console.error("Error clearing location watch:", e);
          }
          locationWatchId.current = null;
        }
        
        // Disconnect socket if connected
        if (socketRef.current) {
          socketRef.current.emit('end_tracking', { 
            userId: localStorage.getItem('userId'),
            finalPath: trackingPath,
            stats: trackingStats
          });
        }
        
        // Reset tracking state
        setIsTracking(false);
        
        // Only offer to save if we have enough data
        if (trackingPath.length >= 3 && trackingStats.distance > 0.01) {
          setTimeout(() => {
            // Ask if user wants to save the tracked path
            if (window.confirm('Would you like to save this tracked route?')) {
              try {
                // Create a title with timestamp to ensure uniqueness
                const routeTitle = prompt(
                  'Enter a name for this tracked route:', 
                  `${selectedRoute ? selectedRoute.title : 'Tracked Route'} - ${new Date().toLocaleTimeString()}`
                );
                
                if (!routeTitle) {
                  console.log("Route save cancelled by user");
                  // Reset tracking stats and path even if user cancels
                  setTrackingStats({
                    distance: 0,
                    duration: 0,
                    speed: 0,
                    startTime: null
                  });
                  setElapsedTime('00:00:00');
                  setTrackingPath([]);
                  return;
                }
                
                // Ensure we have a valid distance (at least 0.01)
                const routeDistance = Math.max(0.01, trackingData.distance);
                
                // Get start, mid, and end points to ensure at least 3 points in path
                const firstPoint = trackingData.path[0];
                const lastPoint = trackingData.path[trackingData.path.length - 1];
                
                // Validate that points have valid coordinates
                if (!Array.isArray(firstPoint) || firstPoint.length < 2 || 
                    !Array.isArray(lastPoint) || lastPoint.length < 2) {
                  alert('Error: Invalid coordinates in tracking data');
                  return;
                }
                
                // Create a simplified path if too many points
                let pathToUse = trackingData.path;
                if (trackingData.path.length > 100) {
                  // Simplify by taking every nth point to keep under 100 points
                  const step = Math.ceil(trackingData.path.length / 100);
                  pathToUse = trackingData.path.filter((_, index) => index % step === 0 || index === trackingData.path.length - 1);
                  
                  // Always ensure we keep first and last point
                  if (!pathToUse.includes(firstPoint)) pathToUse.unshift(firstPoint);
                  if (!pathToUse.includes(lastPoint)) pathToUse.push(lastPoint);
                }
                
                // Format path coordinates correctly for GeoJSON
                const pathCoordinates = pathToUse.map(point => {
                  if (!Array.isArray(point) || point.length < 2 || 
                      isNaN(point[0]) || isNaN(point[1])) {
                    console.warn('Skipping invalid point:', point);
                    return null;
                  }
                  
                  // Convert from [latitude, longitude] to [longitude, latitude]
                  return [point[1], point[0]];
                }).filter(point => point !== null);
                
                // Ensure we still have enough valid points after filtering
                if (pathCoordinates.length < 3) {
                  alert('Error: Not enough valid coordinates in path. Need at least 3 points.');
                  return;
                }
                
                // Create route data with all required fields
                const routeData = {
                  title: routeTitle,
                  description: `Route completed on ${new Date().toLocaleDateString()}`,
                  distance: routeDistance,
                  elevationGain: 0,
                  path: {
                    type: 'LineString',
                    coordinates: pathCoordinates
                  },
                  startPoint: {
                    type: 'Point',
                    coordinates: [firstPoint[1], firstPoint[0]]
                  },
                  endPoint: {
                    type: 'Point',
                    coordinates: [lastPoint[1], lastPoint[0]]
                  },
                  completed: true // Automatically mark as completed
                };
                
                // Get token and save the route
                const token = localStorage.getItem('token');
                if (!token) {
                  alert('Error: You must be logged in to save routes');
                  return;
                }
                
                saveRoute(token, routeData)
                  .then(result => {
                    if (result.success) {
                      alert('Route saved successfully!');
                      // Refresh routes list
                      fetchRoutes();
                      
                      // Ask if the user also wants to save as an activity
                      const saveAsActivity = window.confirm(
                        'Do you also want to save this as an activity? Click OK for activity, Cancel for route only.'
                      );
                      
                      if (saveAsActivity) {
                        // Save as activity
                        saveTrackedRouteAsActivity(trackingData, routeTitle);
                      }
                    } else {
                      alert('Failed to save route: ' + (result.message || 'Unknown server error'));
                      console.error('Route save failed:', result);
                    }
                  })
                  .catch(err => {
                    console.error('Error saving route:', err);
                    alert('Error saving route: ' + (err.message || 'Unknown error occurred'));
                  });
              } catch (error) {
                console.error('Error preparing route data:', error);
                alert('Error preparing route data: ' + error.message);
              }
            }
            
            // Reset tracking stats after saving (or not saving)
            setTrackingStats({
              distance: 0,
              duration: 0,
              speed: 0,
              startTime: null
            });
            setElapsedTime('00:00:00');
            setTrackingPath([]);
          }, 500);
        } else {
          alert('Not enough tracking data to save. You need to move more to create a valid route.');
          
          // Reset tracking stats and path
          setTrackingStats({
            distance: 0,
            duration: 0,
            speed: 0,
            startTime: null
          });
          setElapsedTime('00:00:00');
          setTrackingPath([]);
        }
      }
    } else {
      // Start tracking
      if (!selectedRoute) {
        alert('Please select a route first');
        return;
      }
      
      if (window.confirm('Start tracking this route?')) {
        console.log("Starting tracking with route:", selectedRoute.title);
        
        // FULL RESET OF ALL TRACKING STATE
        // Make sure we clean up ALL previous state completely
        
        // Reset all timers and intervals first
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        
        if (locationWatchId.current !== null) {
          try {
            navigator.geolocation.clearWatch(locationWatchId.current);
          } catch (e) {
            console.error("Error clearing location watch:", e);
          }
          locationWatchId.current = null;
        }
        
        // Reset all tracking stats to initial values
        trackingStatsRef.current = {
          distance: 0,
          duration: 0,
          speed: 0,
          startTime: null,
          lastSyncTime: null
        };
        
        setTrackingStats({
          distance: 0,
          duration: 0,
          speed: 0,
          startTime: null
        });
        
        setElapsedTime('00:00:00');
        setTrackingPath([]);
        
        // Make sure any simulation is fully stopped
        if (isSimulatingRef.current || isSimulating) {
          // Stop simulation timers and intervals
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
          
          // Reset simulation state
          isSimulatingRef.current = false;
          setIsSimulating(false);
          setSimulationStep(0);
          currentSimulationStepRef.current = 0;
          
          console.log("Cleared simulation state before starting real tracking");
        }
        
        // Initialize websocket connection
        if (!socketRef.current) {
          console.log('Initializing socket connection for route tracking');
          initializeSocket();
        }
        
        // Start watching position for tracking with a higher timeout
        let locationAttempts = 0;
        const tryGetLocation = () => {
          locationAttempts++;
          
          // Show a loading message if it's taking a while
          if (locationAttempts > 1) {
            console.log(`Attempting to get location (attempt ${locationAttempts})...`);
            
            // After multiple attempts, show a message to the user
            if (locationAttempts === 3) {
              alert("Getting your location... This might take a moment.");
            }
          }
          
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const initialPos = [position.coords.latitude, position.coords.longitude];
              console.log("Starting new tracking session from location:", initialPos);
              
            setCurrentPosition(initialPos);
            
              // Reset tracking path with only initial position
            setTrackingPath([initialPos]);
            
            // Reset timer and stats with current time
            const now = Date.now();
              const freshStats = {
              distance: 0,
              duration: 0, 
              speed: 0,
              startTime: now,
              lastSyncTime: now
              };
              
              // Reset both state and ref to ensure consistency
              setTrackingStats(freshStats);
              trackingStatsRef.current = { ...freshStats };
            
            // Force immediate timer update
            const startSeconds = 0;
            setElapsedTime(formatTime(startSeconds));
              
              // Clear any existing timer before setting new one
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
            
            // Start timer immediately, using a shorter interval initially
            // to ensure the UI updates quickly
            timerRef.current = setInterval(() => {
              const elapsed = Math.floor((Date.now() - now) / 1000);
              setElapsedTime(formatTime(elapsed));
              
              // Update duration in tracking stats
              setTrackingStats(prev => ({
                ...prev,
                duration: elapsed
              }));
              
              // Switch to normal interval after 3 seconds
              if (elapsed >= 3) {
                clearInterval(timerRef.current);
                timerRef.current = setInterval(updateTimer, 1000);
              }
            }, 100); // Quick updates every 100ms initially
            
            // After the initial rapid updates, switch to normal interval
            setTimeout(() => {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = setInterval(updateTimer, 1000);
              }
            }, 3000);
            
              // Make sure we're not already watching location
              if (locationWatchId.current !== null) {
                try {
                  navigator.geolocation.clearWatch(locationWatchId.current);
                } catch (e) {
                  console.error("Error clearing existing location watch:", e);
                }
                locationWatchId.current = null;
              }
              
              // Tell the server we're starting tracking via socket
              if (socketRef.current) {
                socketRef.current.emit('start_tracking', {
                  userId: localStorage.getItem('userId'),
                  initialPosition: initialPos,
                  route: selectedRoute._id,
                  timestamp: now,
                  activityType: activityType // Include activity type in socket data
                });
              }
              
              // Start session with activity type
              const token = localStorage.getItem('token');
              if (token) {
                startSessionWithActivityType(token, {
                  initialLocation: {
                    coordinates: [initialPos[1], initialPos[0]] // Convert to [lng, lat] for GeoJSON
                  },
                  activityType: activityType // Include selected activity type
                })
                .then(response => {
                  if (response.success) {
                    console.log(`Successfully started ${activityType} session`);
                  } else {
                    console.error('Error starting session:', response.message);
                  }
                })
                .catch(err => {
                  console.error('Error starting tracking session:', err);
                });
              }
              
              // Start location watching with increased timeout
            locationWatchId.current = navigator.geolocation.watchPosition(
              (pos) => {
                const newPos = [pos.coords.latitude, pos.coords.longitude];
                
                // Update current position
                setCurrentPosition(newPos);
                
                // Update tracking path
                setTrackingPath(prevPath => {
                  const newPath = [...prevPath, newPos];
                  
                  // Calculate incremental distance if we have previous points
                  if (prevPath.length > 0) {
                    const lastPos = prevPath[prevPath.length - 1];
                    const incrementalDistance = calculateDistance(lastPos, newPos);
                    
                    // Update tracking stats with new distance
                      const updatedStats = {
                        ...trackingStatsRef.current,
                        distance: trackingStatsRef.current.distance + incrementalDistance,
                      // Update speed (km/h) based on distance and time
                        speed: trackingStatsRef.current.startTime ? 
                          ((trackingStatsRef.current.distance + incrementalDistance) / ((Date.now() - trackingStatsRef.current.startTime) / 3600000)).toFixed(1) : 0
                      };
                      
                      // Update both the ref (immediately) and state (might be delayed)
                      trackingStatsRef.current = updatedStats;
                      setTrackingStats(updatedStats);
                      
                      // Emit location update to server via socket
                      if (socketRef.current && socketRef.current.connected) {
                        socketRef.current.emit('location_update', {
                          userId: localStorage.getItem('userId'),
                          position: newPos,
                          timestamp: Date.now(),
                          stats: updatedStats
                        });
                      }
                  }
                  
                  return newPath;
                });
                
                // Center map on new position if tracking
                if (mapRef) {
                  try {
                    mapRef.setView(newPos, mapRef.getZoom());
                  } catch (e) {
                    console.error('Error setting map view:', e);
                  }
                }
              },
              (err) => {
                console.error('Error watching position:', err);
                  // More user-friendly error message
                  if (err.code === 3) { // Timeout error
                    console.log("Location timeout, retrying...");
                    // Don't alert on timeout, just retry silently
                    if (locationWatchId.current) {
                      navigator.geolocation.clearWatch(locationWatchId.current);
                      locationWatchId.current = null;
                    }
                    // Only stop tracking if we've failed too many times
                    if (locationAttempts > 5) {
                      alert('Could not track your location after multiple attempts. Please check your GPS settings and try again.');
                      setIsTracking(false);
                    } else {
                      // Retry watching position
                      setTimeout(() => {
                        locationWatchId.current = navigator.geolocation.watchPosition(
                          // Same success callback...
                          (pos) => {
                            const newPos = [pos.coords.latitude, pos.coords.longitude];
                            setCurrentPosition(newPos);
                            // Update tracking path...
                            setTrackingPath(prevPath => {
                              const newPath = [...prevPath, newPos];
                              // Calculate distance...
                              if (prevPath.length > 0) {
                                const lastPos = prevPath[prevPath.length - 1];
                                const incrementalDistance = calculateDistance(lastPos, newPos);
                                const updatedStats = {
                                  ...trackingStatsRef.current,
                                  distance: trackingStatsRef.current.distance + incrementalDistance,
                                  speed: trackingStatsRef.current.startTime ? 
                                    ((trackingStatsRef.current.distance + incrementalDistance) / ((Date.now() - trackingStatsRef.current.startTime) / 3600000)).toFixed(1) : 0
                                };
                                
                                // Update both ref and state
                                trackingStatsRef.current = updatedStats;
                                setTrackingStats(updatedStats);
                                
                                // Send update to server
                                if (socketRef.current && socketRef.current.connected) {
                                  socketRef.current.emit('location_update', {
                                    userId: localStorage.getItem('userId'),
                                    position: newPos,
                                    timestamp: Date.now(),
                                    stats: updatedStats
                                  });
                                }
                              }
                              return newPath;
                            });
                            
                            // Center map...
                            if (mapRef) {
                              try {
                                mapRef.setView(newPos, mapRef.getZoom());
                              } catch (e) {
                                console.error('Error setting map view:', e);
                              }
                            }
                          },
                          // Error callback
                          (watchErr) => {
                            console.error('Error on retry watching position:', watchErr);
                            // Only alert for non-timeout errors or final timeout
                            if (watchErr.code !== 3 || locationAttempts > 5) {
                              alert('Error tracking position: ' + watchErr.message);
                              setIsTracking(false);
                            } else {
                              console.log(`Location watch timeout on attempt ${locationAttempts}, will retry...`);
                            }
                          },
                          { 
                            enableHighAccuracy: true,
                            maximumAge: 0,
                            timeout: 15000 // Increased timeout for retries
                          }
                        );
                      }, 1000); // Delay before retry
                    }
                  } else {
                    // For other errors, show the alert
                alert('Error tracking position: ' + err.message);
                setIsTracking(false);
                  }
              },
              { 
                enableHighAccuracy: true,
                maximumAge: 0,
                  timeout: 10000 // Increased from 5000 to 10000
              }
            );
            
            // Set tracking state first, so UI updates immediately
        setIsTracking(true);
          },
          (err) => {
            console.error('Error getting initial position:', err);
              
              if (err.code === 3) { // Timeout error
                if (locationAttempts < 3) {
                  console.log("Initial location timeout, retrying...");
                  setTimeout(tryGetLocation, 1000);
                } else {
                  alert('Location access timed out. Please check your GPS settings and try again.');
                }
              } else {
            alert('Error accessing location: ' + err.message);
              }
            },
            { 
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 10000 // Increased from 5000 to 10000
            }
          );
        };
        
        // Start the location getting process
        tryGetLocation();
      }
    }
  };

  // Function to save tracked route as an activity
  const saveTrackedRouteAsActivity = async (trackingData, activityTitle) => {
    try {
      if (!trackingData || !trackingData.path || trackingData.path.length < 3) {
        alert('Not enough tracking points to save an activity.');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Error: You must be logged in to save activities');
        return;
      }
      
      // Use the tracking data to create timestamps
      const pathToUse = trackingData.path;
      const startTime = trackingData.startTime || Date.now() - (trackingData.duration * 1000);
      const duration = trackingData.duration || 60; // Minimum 1 minute
      const timePerPoint = duration * 1000 / pathToUse.length;
      
      // Ensure distance is valid - calculate if not provided or zero
      let distance = trackingData.distance;
      if (!distance || distance <= 0) {
        console.log("Recalculating distance for activity");
        distance = calculateRouteDistance(pathToUse);
        
        // Ensure minimum distance
        if (distance < 0.001) {
          console.log("Setting minimum distance value");
          distance = 0.001; // Minimum value to pass validation
        }
      }
      
      console.log("Activity distance:", distance);
      
      // Format location history for the API with proper timestamps and coordinates
      const locationHistory = pathToUse.map((point, index) => ({
        timestamp: new Date(startTime + (index * timePerPoint)),
        coordinates: [point[1], point[0]], // Convert from [lat, lng] to [lng, lat]
        speed: parseFloat(trackingData.speed) || 5 // Default speed if not available
      }));
      
      console.log("Starting session with initial location:", [pathToUse[0][1], pathToUse[0][0]]);
      
      // First start a session (required by the API flow)
      const startResponse = await startSessionWithActivityType(token, {
        initialLocation: {
          coordinates: [pathToUse[0][1], pathToUse[0][0]] // First point [lng, lat]
        },
        activityType: activityType // Use selected activity type
      });
      
      if (!startResponse.success) {
        console.error("Failed to start session:", startResponse.message);
        alert(`Error starting session: ${startResponse.message}`);
        return;
      }
      
      console.log("Session started successfully, now stopping to create activity");
      
      // Extract the last point for final location
      const lastPoint = pathToUse[pathToUse.length - 1];
      
      // Calculate speed stats
      const avgSpeed = trackingData.speed || (distance / (duration / 3600));
      const maxSpeed = parseFloat(avgSpeed) * 1.2 || 10; // Estimate max speed as 20% higher than average
      
      // Immediately stop the session to create the activity
      const stopResponse = await stopSession(token, {
        finalLocation: {
          coordinates: [lastPoint[1], lastPoint[0]] // Last point [lng, lat]
        },
        locationHistory: locationHistory.map(item => ({
          timestamp: item.timestamp,
          location: {
            type: 'Point',
            coordinates: item.coordinates
          },
          speed: item.speed
        })),
        totalDistance: distance,
        totalDuration: duration,
        title: activityTitle,
        activityType: activityType, // Use selected activity type
        // Convert the route for the API
        route: {
          type: 'LineString',
          coordinates: pathToUse.map(point => [point[1], point[0]])
        },
        averageSpeed: avgSpeed,
        maxSpeed: maxSpeed,
        simulated: false // Mark activity as not simulated
      });
      
      if (stopResponse.success) {
        alert('Activity saved successfully!');
        console.log("Activity created:", stopResponse.data?.activity?._id);
      } else {
        console.error("Failed to create activity:", stopResponse);
        alert(`Error saving activity: ${stopResponse.message}`);
      }
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Error saving activity: ' + error.message);
    }
  };

  // Fix map when it's loaded - with safety checks and delay
  useEffect(() => {
    let timeoutId;
    
    if (mapRef) {
      // Force map to update its size after it's fully loaded
      // Use longer timeout to ensure DOM is ready
      timeoutId = setTimeout(() => {
        try {
          // Ensure map is valid before calling methods
          if (mapRef && typeof mapRef.invalidateSize === 'function' && 
              mapRef._container && mapRef._loaded && 
              mapRef._mapPane && mapRef._mapPane._leaflet_pos) {
            mapRef.invalidateSize(true);
            
            // Center on user location if available and no route is selected
            if (!selectedRoute && currentPosition) {
              mapRef.setView(currentPosition, 14);
            }
          }
        } catch (error) {
          console.error('Error invalidating map size:', error);
        }
      }, 700);
    }
    
    return () => {
      // Clear timeout on cleanup
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Clean up any existing map markers to prevent memory leaks
      if (mapRef) {
        try {
          // It's safer not to directly manipulate the map on cleanup
          // This is handled by react-leaflet's component lifecycle
          console.log("Map component cleaning up");
        } catch (error) {
          console.error("Error cleaning up map:", error);
        }
      }
    };
  }, [mapRef, mapKey, currentPosition, selectedRoute]);

  // Reset view to current location - with safety checks
  const resetToCurrentLocation = () => {
    if (currentPosition && mapRef && typeof mapRef.setView === 'function') {
      try {
        console.log('Resetting view to current location:', currentPosition);
        mapRef.setView(currentPosition, 15);
      } catch (error) {
        console.error('Error setting map view:', error);
      }
    }
  };

  // Parse GeoJSON coordinates to Leaflet format - simplified and improved
  const parseCoordinates = (geoJson) => {
    // If null or undefined, return empty array
    if (!geoJson) return [];
    
    // If it's a string, try to parse it
    if (typeof geoJson === 'string') {
      try {
        geoJson = JSON.parse(geoJson);
      } catch (e) {
        console.error('Error parsing GeoJSON string:', e);
        return [];
      }
    }
    
    // Handle GeoJSON object with coordinates
    if (geoJson.type === 'LineString' && Array.isArray(geoJson.coordinates)) {
      return geoJson.coordinates.map(coord => 
        Array.isArray(coord) && coord.length >= 2 ? [coord[1], coord[0]] : OLONGAPO_COORDINATES
      );
    }
    
    // Handle direct array of coordinates
    if (Array.isArray(geoJson) && geoJson.length > 0) {
      if (Array.isArray(geoJson[0])) {
        return geoJson.map(coord => 
          coord.length >= 2 ? [coord[1], coord[0]] : OLONGAPO_COORDINATES
        );
      }
    }
    
    console.error('Unable to parse coordinates:', geoJson);
    return [];
  }

  // Save route function
  const handleSaveRoute = async () => {
    if (!selectedRoute) {
      alert('Please generate or select a route first');
      return;
    }
    
    // Don't save already saved routes
    if (selectedRoute._id && !selectedRoute._id.startsWith('generated-')) {
      alert('This route is already saved');
      return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login first to save routes');
      return;
    }
    
    // Prompt for route name
    const routeName = prompt('Enter a name for this route:', selectedRoute.title || 'My Route');
    if (!routeName) return; // User cancelled
    
    // For regular routes that weren't tracked or simulated, still ask if completed
    const isCompleted = window.confirm('Is this a route you have already completed?');
    
    try {
      // Prepare route data for saving
      const routeData = {
        title: routeName,
        description: `Route created on ${new Date().toLocaleDateString()}`,
        distance: selectedRoute.distance || calculateRouteDistance(selectedRoute.pathCoordinates),
        elevationGain: selectedRoute.elevationGain || 0,
        // Convert from Leaflet format [lat, lng] to GeoJSON [lng, lat]
        path: {
          type: 'LineString',
          coordinates: selectedRoute.pathCoordinates.map(coord => [coord[1], coord[0]])
        },
        startPoint: {
          type: 'Point',
          coordinates: [selectedRoute.startPoint[1], selectedRoute.startPoint[0]]
        },
        endPoint: {
          type: 'Point',
          coordinates: [selectedRoute.endPoint[1], selectedRoute.endPoint[0]]
        },
        completed: isCompleted
      };
      
      const result = await saveRoute(token, routeData);
      
      if (result.success) {
        if (result.duplicate) {
          alert('This route has already been saved as completed!');
        } else {
        alert('Route saved successfully!');
        }
        // Refresh routes list
        fetchRoutes();
      } else {
        alert('Failed to save route: ' + result.message);
      }
    } catch (err) {
      console.error('Error saving route:', err);
      alert('Error saving route: ' + err.message);
    }
  };
  
  // Calculate route distance helper
  const calculateRouteDistance = (coordinates) => {
    if (!coordinates || coordinates.length < 2) return 0;
    
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const point1 = coordinates[i-1];
      const point2 = coordinates[i];
      
      // Ensure we have valid coordinates
      if (!point1 || !point2 || point1.length < 2 || point2.length < 2) {
        console.error('Invalid coordinate pair:', point1, point2);
        continue;
      }
      
      // Extract lat/lng correctly - coordinates are in [lat, lng] format in this context
      const lat1 = point1[0];
      const lng1 = point1[1];
      const lat2 = point2[0];
      const lng2 = point2[1];
      
      // Haversine formula for distance
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lng2 - lng1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      total += distance;
    }
    
    console.log(`Calculated route distance: ${total.toFixed(3)} km from ${coordinates.length} points`);
    return total;
  };

  // Add a click handler for the map when in pinning mode
  const MapClickHandler = () => {
    const map = useMap();
    
    useEffect(() => {
      if (!map) return;
      
      const handleMapClick = (e) => {
        if (isPinningLocation) {
          const { lat, lng } = e.latlng;
          setCurrentPosition([lat, lng]);
          setIsPinningLocation(false);
          
          // Show a success notification
          const notification = document.createElement('div');
          notification.className = 'location-pin-notification';
          notification.innerHTML = `<div style="position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">Location set successfully!</div>`;
          document.body.appendChild(notification);
          
          // Remove notification after 2 seconds
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 2000);
        }
        
        // Handle route pin mode
        if (isRoutePinMode && routePinType) {
          const { lat, lng } = e.latlng;
          const updatedRoute = { ...manualRoute };
          
          if (routePinType === 'start') {
            updatedRoute.startPoint.coordinates = [lng, lat]; // [lng, lat]
            
            // Update distance calculation
            updatedRoute.distance = calculateManualRouteDistance(updatedRoute);
            setManualRoute(updatedRoute);
            
            // Exit pin mode after setting start point
            setIsRoutePinMode(false);
            setRoutePinType(null);
            
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'route-pin-notification';
            notification.innerHTML = `<div style="position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">Start point set!</div>`;
            document.body.appendChild(notification);
            
            // Remove notification after 2 seconds
            setTimeout(() => {
              document.body.removeChild(notification);
            }, 2000);
          } else if (routePinType === 'end') {
            updatedRoute.endPoint.coordinates = [lng, lat]; // [lng, lat]
            
            // Update distance calculation
            updatedRoute.distance = calculateManualRouteDistance(updatedRoute);
            setManualRoute(updatedRoute);
            
            // Exit pin mode after setting end point
            setIsRoutePinMode(false);
            setRoutePinType(null);
            
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'route-pin-notification';
            notification.innerHTML = `<div style="position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">End point set!</div>`;
            document.body.appendChild(notification);
            
            // Remove notification after 2 seconds
            setTimeout(() => {
              document.body.removeChild(notification);
            }, 2000);
          } else if (routePinType === 'path') {
            updatedRoute.path.coordinates.push([lng, lat]); // [lng, lat]
            
            // Update distance calculation
            updatedRoute.distance = calculateManualRouteDistance(updatedRoute);
            setManualRoute(updatedRoute);
            
            // Don't exit pin mode for path, allow multiple points to be added
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'route-pin-notification';
            notification.innerHTML = `<div style="position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 4px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">Waypoint added!</div>`;
            document.body.appendChild(notification);
            
            // Remove notification after 1 second
            setTimeout(() => {
              document.body.removeChild(notification);
            }, 1000);
          }
        }
      };
      
      map.on('click', handleMapClick);
      
      return () => {
        map.off('click', handleMapClick);
      };
    }, [map, isPinningLocation, isRoutePinMode, routePinType, manualRoute]);
    
    return null;
  };

  // Add this function to refresh the map and force route display
  const refreshMap = () => {
    console.log('Forcing map refresh');
    setMapKey(Date.now());
    
    // Additional check to ensure the map redraws correctly
    if (mapRef) {
      setTimeout(() => {
        try {
          mapRef.invalidateSize();
          
          // If we have a selected route, fit the map to it
          if (selectedRoute && selectedRoute.pathCoordinates && selectedRoute.pathCoordinates.length >= 2) {
            try {
              const bounds = L.latLngBounds(selectedRoute.pathCoordinates);
              mapRef.fitBounds(bounds, { padding: [50, 50] });
            } catch (e) {
              console.error('Error fitting bounds during refresh:', e);
              mapRef.setView(selectedRoute.startPoint, 14);
            }
          } else {
            // If no route is selected, focus on user's current position
            resetToCurrentLocation();
          }
        } catch (e) {
          console.error('Error refreshing map:', e);
        }
      }, 300);
    }
  };

  // Handle map initialization and cleanup
  React.useEffect(() => {
    // Add CSS animation for route lines
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes dash {
        to {
          stroke-dashoffset: -20;
        }
      }
      .leaflet-interactive {
        animation: dash 1.5s linear infinite;
      }
    `;
    document.head.appendChild(style);
    
    // Clean up function - executed when component unmounts
    return () => {
      // Remove style elements
      if (document.head.contains(style)) {
      document.head.removeChild(style);
      }
      
      // Clean up ALL possible map instances to prevent "container being reused" error
      try {
        // Get all Leaflet map containers that might exist
        const mapContainers = document.querySelectorAll('.leaflet-container');
        
        // Clean up each container and its map instance
        mapContainers.forEach(container => {
          // Get the map instance from the container (if it exists)
          const mapInstance = container._leaflet_id ? L.maps[container._leaflet_id] : null;
          
          if (mapInstance) {
            // Stop all animations and timers
            mapInstance.stopLocate();
            mapInstance.stop(); // Stop all animations
            
            // Remove all layers
            mapInstance.eachLayer(layer => {
              if (layer) {
                try {
                  mapInstance.removeLayer(layer);
                } catch (e) {
                  // Ignore errors removing layers
                }
              }
            });
            
            // Remove all event listeners
            mapInstance.off();
            
            // Remove all controls
            if (mapInstance._controlCorners) {
              Object.keys(mapInstance._controlCorners).forEach(cornerName => {
                const corner = mapInstance._controlCorners[cornerName];
                while (corner && corner.firstChild) {
                  corner.removeChild(corner.firstChild);
                }
              });
            }
            
            // Remove the map completely
            mapInstance.remove();
            
            // Make sure the container is cleaned up
            if (container.parentNode) {
              try {
                // Remove all child elements first
                while (container.firstChild) {
                  container.removeChild(container.firstChild);
                }
                
                // Then remove the container itself
                container.parentNode.removeChild(container);
              } catch (e) {
                console.error('Error removing map container:', e);
              }
            }
          }
        });
        
        // Clear any map reference
        if (mapRef) {
          setMapRef(null);
        }
        
        // Force a global cleanup of all Leaflet resources
        for (const prop in L) {
          if (L[prop] && L[prop].cleanup) {
            L[prop].cleanup();
          }
        }
      } catch (e) {
        console.error('Error during map cleanup:', e);
      }
    };
  }, []);

  // Add this function to clear the current route
  const clearCurrentRoute = () => {
    if (isTracking) {
      if (window.confirm('You are currently tracking a route. Stop tracking and clear the route?')) {
        setIsTracking(false);
        setSelectedRoute(null);
        setShowRouteInfo(false);
      }
    } else {
      setSelectedRoute(null);
      setShowRouteInfo(false);
    }
  };

  // Initialize Socket.io connection
  const initializeSocket = () => {
    // Correct server address from environment or use default
    const serverUrl = SOCKET_URL;
    console.log('Connecting to socket server at:', serverUrl);
    
    // Clear any existing socket
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (e) {
        console.error('Error disconnecting socket:', e);
      }
    }
    
    // Create new socket connection
    const socket = io(serverUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      auth: {
        token: localStorage.getItem('token')
      }
    });

    socket.on('connect', () => {
      console.log('Socket connected successfully with ID:', socket.id);
      
      // Send initial presence so server knows we're online
      const userId = localStorage.getItem('userId');
      if (userId) {
        socket.emit('user_online', {
          userId,
          timestamp: Date.now(),
          position: currentPosition
        });
      }
    });

    socket.on('connection_confirmed', (data) => {
      console.log('Connection confirmed by server:', data);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      // Don't show alert, just log the error as user is not explicitly requesting tracking
      console.log('WebSocket connection not available, tracking will use local data only');
    });

    socket.on('tracking_started', (data) => {
      console.log('Server acknowledged tracking start:', data);
      if (data.success && data.timestamp) {
        // Update start time to match server's timestamp
        const serverStartTime = new Date(data.timestamp).getTime();
        setTrackingStats(prev => ({
          ...prev,
          startTime: serverStartTime,
          lastSyncTime: Date.now(),
          serverTimeSync: Date.now() - serverStartTime
        }));
        
        trackingStatsRef.current = {
          ...trackingStatsRef.current,
          startTime: serverStartTime,
          lastSyncTime: Date.now(),
          serverTimeSync: Date.now() - serverStartTime
        };
      }
    });

    socket.on('time_sync', (data) => {
      // Update based on server's elapsed time to keep in sync
      if (data.elapsedMs && data.startTime) {
        console.log('Time sync from server:', data);
        
        const serverStartTime = new Date(data.startTime).getTime();
        
        // Update both state and ref for consistency
        setTrackingStats(prev => ({
          ...prev,
          serverTimeSync: data.elapsedMs,
          startTime: serverStartTime,
          lastSyncTime: Date.now()
        }));
        
        trackingStatsRef.current = {
          ...trackingStatsRef.current,
          serverTimeSync: data.elapsedMs,
          startTime: serverStartTime,
          lastSyncTime: Date.now()
        };
        
        // Update timer display
        const seconds = Math.floor(data.elapsedMs / 1000);
        setElapsedTime(formatTime(seconds));
      }
    });

    socket.on('location_update_ack', (data) => {
      console.log('Server acknowledged location update:', data);
      
      // Update stats if server provides them
      if (data.stats) {
        const { distance, duration, speed, elapsedMs } = data.stats;
        
        // Only update if we have values and they differ from current
        if (typeof distance === 'number' && typeof duration === 'number') {
          console.log(`Updating stats from server: ${distance.toFixed(2)}km in ${formatTime(Math.floor(duration))}`);
          
          // Update both state and ref for consistency
          setTrackingStats(prev => ({
            ...prev,
            distance: distance,
            duration: duration,
            speed: speed || prev.speed
          }));
          
          trackingStatsRef.current = {
            ...trackingStatsRef.current,
            distance: distance,
            duration: duration,
            speed: speed || trackingStatsRef.current.speed
          };
          
          // Update timer display from server elapsed time if available
          if (elapsedMs) {
            const seconds = Math.floor(elapsedMs / 1000);
            setElapsedTime(formatTime(seconds));
          }
        }
      }
    });

    socket.on('tracking_ended', (data) => {
      console.log('Server confirmed tracking ended:', data);
      // Final stats could be applied here if needed
    });

    socket.on('tracking_error', (error) => {
      console.error('Tracking error from server:', error);
      // Don't show alert to avoid disrupting the user
      console.error(`Tracking error: ${error.message}`);
    });
    
    // Listen for nearby users (social features)
    socket.on('nearby_users', (data) => {
      console.log('Received nearby users update:', data);
      // Could display these on the map if desired
    });
    
    // Listen for route progress updates from server
    socket.on('route_progress', (data) => {
      if (data && data.progress && isTracking) {
        console.log('Server calculated route progress:', data.progress);
        // You could update UI to show route completion percentage
      }
    });
    
    // Add socket reconnect handling to improve robustness
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      
      // If we're currently tracking, notify the server to re-sync data
      if (isTracking) {
        socket.emit('re_sync_tracking', {
          userId: localStorage.getItem('userId'),
          position: currentPosition,
          timestamp: Date.now(),
          stats: trackingStatsRef.current,
          route: selectedRoute?._id,
          trackingPath: trackingPath
        });
      } else {
        // Otherwise just send current location
        socket.emit('user_online', {
          userId: localStorage.getItem('userId'),
          timestamp: Date.now(),
          position: currentPosition
        });
      }
    });

    socketRef.current = socket;
    return socket;
  };

  // Cleanup socket connection
  useEffect(() => {
    // Initialize websocket connection on component mount
    if (!socketRef.current) {
      initializeSocket();
    }
    
    return () => {
      // Clean up socket connection when component unmounts
      if (socketRef.current) {
        try {
          // Notify server that user is going offline
          socketRef.current.emit('user_offline', {
            userId: localStorage.getItem('userId'),
            timestamp: Date.now()
          });
          
          if (isTracking) {
            // Let server know we're ending tracking before disconnecting
            socketRef.current.emit('end_tracking', { 
              userId: localStorage.getItem('userId'),
              finalPath: trackingPath,
              stats: trackingStatsRef.current
            });
          }
          
          // Properly disconnect
        socketRef.current.disconnect();
        } catch (e) {
          console.error('Error disconnecting socket:', e);
        }
        socketRef.current = null;
      }
      
      // Clean up location watching
      if (locationWatchId.current !== null) {
        try {
          navigator.geolocation.clearWatch(locationWatchId.current);
        } catch (e) {
          console.error("Error clearing location watch:", e);
        }
        locationWatchId.current = null;
      }
      
      // Clean up timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (locationUpdateTimerRef.current) {
        clearInterval(locationUpdateTimerRef.current);
        locationUpdateTimerRef.current = null;
      }
      
      // Clean up simulation interval if it exists
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format time for display (HH:MM:SS)
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update timer with server sync
  const updateTimer = () => {
    // Use the persistent ref for tracking stats to avoid reset issues
    const stats = trackingStatsRef.current;
    
    // Make sure we have a valid starting time
    if (!stats.startTime) {
      console.warn('Timer update called without startTime, setting current time');
      const now = Date.now();
      
      // Update both the state and the ref
      trackingStatsRef.current = {
        ...stats,
        startTime: now,
        lastSyncTime: now
      };
      
      // Also update React state (this may happen asynchronously)
      setTrackingStats(prev => ({
        ...prev,
        startTime: now,
        lastSyncTime: now
      }));
      
      return;
    }
      
    const currentTime = Date.now();
      
    // Use server-synced time if available, otherwise use client time
    let elapsedMs;
      
    if (stats.serverTimeSync && stats.lastSyncTime) {
      // Calculate elapsed time based on the last server sync
      const timeSinceSyncMs = currentTime - stats.lastSyncTime;
      elapsedMs = stats.serverTimeSync + timeSinceSyncMs;
    } else {
      // Use local time if no server sync available
      elapsedMs = currentTime - stats.startTime;
    }
      
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
      
    // Always update the time display
    const formattedTime = formatTime(elapsedSeconds);
    setElapsedTime(formattedTime);
    
    // Log timer updates during simulation to debug time issues
    if (isSimulatingRef.current) {
      console.log(`Timer update: ${formattedTime}, elapsed: ${elapsedSeconds}s, startTime: ${new Date(stats.startTime).toISOString()}`);
    }
      
    // Update tracking stats in both ref and state
    const updatedStats = {
      ...stats,
      duration: elapsedSeconds,
      speed: isSimulatingRef.current ? (simulationSpeed * 5).toFixed(1) : 
             (elapsedSeconds > 0 && stats.distance > 0 ? (stats.distance / (elapsedSeconds / 3600)).toFixed(1) : '0.0'),
      lastSyncTime: currentTime
    };
    
    // Update the ref first (this is immediate)
    trackingStatsRef.current = updatedStats;
    
    // Then update React state (this may be delayed)
    setTrackingStats(updatedStats);
  };

  // Toggle simulation state
  const toggleSimulation = () => {
    if (isSimulatingRef.current) {
      console.log("Stopping simulation");
      // Stop simulation
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Ask user if they want to stay at current position or reset
      const shouldReset = window.confirm('Do you want to reset the simulation? Click Cancel to stay at the current position.');
      
      if (shouldReset) {
        // Reset simulation state
        isSimulatingRef.current = false;
        setIsSimulating(false);
        setSimulationStep(0);
        currentSimulationStepRef.current = 0;
        selectedRouteRef.current = null;
        trackingStartTimeRef.current = null;
        
        // Reset tracking refs
        trackingStatsRef.current = {
          distance: 0,
          duration: 0,
          speed: 0,
          startTime: null,
          lastSyncTime: null
        };
        
        // If we were tracking during simulation, stop tracking too
        if (isTracking) {
          // Reset tracking stats
          setTrackingStats({
            distance: 0,
            duration: 0,
            speed: 0,
            startTime: null
          });
          setElapsedTime('00:00:00');
          
          // Reset tracking state
          setIsTracking(false);
          setTrackingPath([]);
        }
      } else {
        // Just stop simulation but maintain current position
        isSimulatingRef.current = false;
        setIsSimulating(false);
        // Keep currentSimulationStepRef at its current value
        selectedRouteRef.current = null;
        trackingStartTimeRef.current = null;
      }
    } else {
      // Start simulation
      console.log("Starting simulation");
      
      if (!selectedRoute || !selectedRoute.pathCoordinates || selectedRoute.pathCoordinates.length < 2) {
        alert('Please select a route with valid coordinates first');
        return;
      }
      
      console.log("Route for simulation:", selectedRoute.title, "Points:", selectedRoute.pathCoordinates.length);
      
      if (isTracking) {
        alert('Already tracking. Please stop tracking before simulating.');
        return;
      }
      
      // Confirm simulation
      if (!window.confirm('This will simulate movement along the route. Continue?')) {
        return;
      }
      
      // Clear any existing simulation or tracking state
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Reset tracking path
      setTrackingPath([]);
      
      // Store the selected route in the ref for stability during simulation
      selectedRouteRef.current = JSON.parse(JSON.stringify(selectedRoute));
      console.log("Route data stored in ref:", selectedRouteRef.current);
      
      // Set initial position to start of route
      const startPoint = selectedRoute.pathCoordinates[0];
      console.log("Setting initial position to:", startPoint);
      
      // Update currentPosition before starting tracking
      setCurrentPosition(startPoint);
      
      // Initialize tracking path with at least the first point
      const initialPath = [startPoint];
      setTrackingPath(initialPath);
      
      // Start directly without setTimeout to minimize delays
      // Initialize tracking state
      setIsTracking(true);
      
      // Set simulation state
      isSimulatingRef.current = true;
      setIsSimulating(true);
      setSimulationStep(0);
      currentSimulationStepRef.current = 0;
      
      // Initialize tracking stats with current time
      const now = Date.now();
      
      // Store start time in persistent ref
      trackingStartTimeRef.current = now;
      
      // Initialize tracking stats with explicit values in both refs and state
      const initialStats = {
        distance: 0,
        duration: 0, 
        speed: (simulationSpeed * 5).toFixed(1), // Initial speed based on simulation speed
        startTime: now,
        lastSyncTime: now,
        progress: 0,
        routeDistance: selectedRoute.distance || calculateRouteDistance(selectedRoute.pathCoordinates),
        totalPoints: selectedRoute.pathCoordinates.length,
        currentPoint: 0
      };
      
      // Update both refs and state
      trackingStatsRef.current = { ...initialStats };
      console.log("Setting initial tracking stats:", initialStats);
      setTrackingStats(initialStats);
      
      // Set initial timer display
      setElapsedTime('00:00:00');
      
      // Set up persistent timer reference
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Start with frequent updates using persistent ref
      timerIntervalRef.current = setInterval(() => {
        updateTimer();
      }, 1000);
      
      // Calculate interval based on speed
      const baseInterval = 2000; // 2 seconds at speed 1
      const interval = Math.max(200, baseInterval / simulationSpeed); // Ensure minimum interval
      
      console.log(`Starting simulation with interval ${interval}ms (speed: ${simulationSpeed}x)`);
      
      // Clear any existing interval before setting a new one
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      
      // Start simulation interval
      simulationIntervalRef.current = setInterval(simulateMovement, interval);
      
      // Force immediate first step to start the simulation instantly
      console.log("Triggering immediate first simulation step");
      setTimeout(() => {
        if (isSimulatingRef.current) {
          simulateMovement();
        }
      }, 50);
    }
  };
  
  // Function to simulate a single movement step
  const simulateMovement = () => {
    // Get current step from ref
    const currentStep = currentSimulationStepRef.current;
    
    // Calculate next step
    const nextStep = currentStep + 1;
    
    // Get route from ref for stability
    const routeData = selectedRouteRef.current || selectedRoute;
    
    // Check if simulation is still active with detailed logging
    if (!isSimulatingRef.current) {
      console.log("Simulation stopping - isSimulating is false");
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }
    
    if (!routeData) {
      console.log("Simulation stopping - route data is missing");
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }
    
    if (!routeData.pathCoordinates || !Array.isArray(routeData.pathCoordinates)) {
      console.log("Simulation stopping - route path coordinates invalid:", routeData.pathCoordinates);
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      return;
    }
    
    // Check if we've reached the end of the route (only after processing the final point)
    const isLastPoint = nextStep >= routeData.pathCoordinates.length;
    
    // Process the next point if we haven't reached the end yet
    if (!isLastPoint) {
      try {
        // Get next point from route (safely)
        const nextPoint = routeData.pathCoordinates[nextStep];
        
        // Make sure we have a valid point
        if (!nextPoint || nextPoint.length < 2) {
          console.error("Invalid route point:", nextPoint, "at step", nextStep);
          return;
        }
        
        // Update the ref first (important for next iteration)
        currentSimulationStepRef.current = nextStep;
        
        // Then update the state (might be delayed)
        setSimulationStep(nextStep);
        
        // Update current position to simulate movement
        setCurrentPosition(nextPoint);
        
        // Log movement to verify it's happening
        if (nextStep % 5 === 0 || nextStep === 1 || nextStep === routeData.pathCoordinates.length - 1) {
          console.log(`Simulation step ${nextStep}/${routeData.pathCoordinates.length - 1}: Moving to point`, nextPoint);
        }
        
        // If we're tracking, update tracking path
        if (isTracking) {
          const prevPoint = routeData.pathCoordinates[currentStep];
          
          // Calculate incremental distance (safely)
          if (prevPoint && prevPoint.length >= 2 && nextPoint && nextPoint.length >= 2) {
            const incrementalDistance = calculateDistance(prevPoint, nextPoint);
            
            // Calculate total distance for route progress tracking
            let totalDistance = 0;
            for (let i = 1; i < routeData.pathCoordinates.length; i++) {
              const p1 = routeData.pathCoordinates[i-1];
              const p2 = routeData.pathCoordinates[i];
              if (p1 && p2 && p1.length >= 2 && p2.length >= 2) {
                totalDistance += calculateDistance(p1, p2);
              }
            }
            
            // Calculate progress percentage
            const progress = Math.min(100, Math.round((nextStep / (routeData.pathCoordinates.length - 1)) * 100));
            
            if (progress % 10 === 0 || nextStep === 1 || nextStep === routeData.pathCoordinates.length - 1) {
              console.log(`Progress: ${progress}%, Step: ${nextStep}/${routeData.pathCoordinates.length - 1}`);
            }
            
            // Update tracking stats with progress tracking
            // eslint-disable-next-line no-unused-vars
            const newDistance = (trackingStatsRef.current.distance || 0) + incrementalDistance;
            const totalRouteDistance = routeData.distance || totalDistance;
            
            // Update the ref first (this is immediate)
            trackingStatsRef.current = {
              ...trackingStatsRef.current,
              distance: newDistance,
              // Update speed based on simulation speed setting (with fallbacks)
              speed: (simulationSpeed * 5).toFixed(1),
              progress: progress,
              routeDistance: totalRouteDistance,
              totalPoints: routeData.pathCoordinates.length,
              currentPoint: nextStep
            };
            
            // Then update React state (this may be delayed)
            setTrackingStats({
              ...trackingStatsRef.current
            });
            
            // Always update tracking path with each point to ensure we have the complete route
            setTrackingPath(prevPath => {
              // Only add the point if it's not already the last point (to avoid duplicates)
              if (prevPath.length === 0 || 
                  prevPath[prevPath.length-1][0] !== nextPoint[0] || 
                  prevPath[prevPath.length-1][1] !== nextPoint[1]) {
                return [...prevPath, nextPoint];
              }
              return prevPath;
            });
          }
        }
        
        // If this is the final point, end the simulation after a short delay
        if (nextStep === routeData.pathCoordinates.length - 1) {
          console.log("Reached final point in route, ending simulation after delay");
          setTimeout(finalizeSimulation, 500);
        }
      } catch (error) {
        console.error("Error in simulation movement:", error);
      }
    } else {
      // We've gone beyond the last point, finalize the simulation
      finalizeSimulation();
    }
  };
  
  // Helper function to finalize the simulation
  const finalizeSimulation = () => {
    console.log("Finalizing simulation");
    
    // Get route from ref for stability
    const routeData = selectedRouteRef.current || selectedRoute;
    
    // End simulation intervals
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    
    // Make sure we have the complete path for saving
    // This ensures we have all the route points in trackingPath even if some steps were skipped
    if (isTracking && routeData && routeData.pathCoordinates) {
      console.log(`Finalizing tracking path: current length = ${trackingPath.length}, route length = ${routeData.pathCoordinates.length}`);
      
      // Create a full copy of the route path to ensure we have ALL points
      // This is critical for activity creation which needs detailed route data
      const finalPath = [...routeData.pathCoordinates];
      setTrackingPath(finalPath);
      
      // Update stats one last time with accurate data
      const finalDistance = calculateRouteDistance(finalPath);
      console.log(`Final route distance: ${finalDistance.toFixed(2)}km`);
      
      // Ensure we have good simulated duration data
      const simulatedDuration = trackingStatsRef.current.duration || Math.max(60, Math.round(finalDistance * 5 * 60)); // ~5 min/km pace if no duration
      
      trackingStatsRef.current = {
        ...trackingStatsRef.current,
        distance: finalDistance,
        duration: simulatedDuration,
        progress: 100,
        currentPoint: routeData.pathCoordinates.length - 1
      };
      
      setTrackingStats({
        ...trackingStatsRef.current
      });
    }
    
    // Only finalize if we're still simulating
    if (!isSimulatingRef.current) return;
    
    // Keep position at final point but finish simulation
    isSimulatingRef.current = false;
    setIsSimulating(false);
    
    // Give user a chance to see/save final state
    setTimeout(() => {
      // Show completion message and offer save options
      const saveChoice = window.confirm('Simulation completed! Would you like to save this route?');
      
      if (saveChoice) {
        // Ask whether to save as route or activity
        const saveAsActivity = window.confirm(
          'Do you want to save this as an activity? (Click OK for activity, Cancel for route only)'
        );
        
        if (saveAsActivity) {
          // Save as activity
          saveSimulatedRouteAsActivity();
        } else {
          // Save as route only
          saveSimulatedRoute();
        }
      }
      
      // Only reset state after user acknowledges
      currentSimulationStepRef.current = 0;
      setSimulationStep(0);
      selectedRouteRef.current = null;
      
      // Only stop tracking and reset stats if user confirms
      if (isTracking && window.confirm('Would you like to end tracking and reset?')) {
        // Clear timers first
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // Reset tracking stats
        setTrackingStats({
          distance: 0,
          duration: 0,
          speed: 0,
          startTime: null
        });
        setElapsedTime('00:00:00');
        
        // Reset tracking state
        setIsTracking(false);
        setTrackingPath([]);
      }
    }, 100);
  };

  // Update simulation interval when speed changes
  useEffect(() => {
    if (isSimulatingRef.current && simulationIntervalRef.current) {
      console.log(`Updating simulation speed to ${simulationSpeed}x`);
      // Clear existing interval
      clearInterval(simulationIntervalRef.current);
      
      // Calculate new interval based on speed
      const baseInterval = 2000; // 2 seconds at speed 1
      const interval = Math.max(200, baseInterval / simulationSpeed); // Ensure minimum interval
      
      // Start new interval with updated speed
      simulationIntervalRef.current = setInterval(simulateMovement, interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationSpeed]);

  // Keep selectedRouteRef in sync with selectedRoute state when it changes
  useEffect(() => {
    if (selectedRoute && isSimulatingRef.current) {
      // Only update the ref during simulation if necessary (avoid deep cloning unnecessarily)
      console.log("Updating route ref during simulation");
      selectedRouteRef.current = JSON.parse(JSON.stringify(selectedRoute));
    }
  }, [selectedRoute]);

  // Function to save simulated route after completion
  const saveSimulatedRoute = () => {
    console.log("saveSimulatedRoute called - tracking points:", trackingPath ? trackingPath.length : 0);
    
    // Use the original route path if tracking path is insufficient
    let pathToUse = trackingPath;
    
    // If tracking path is too short but we have a route with valid coordinates, use the route's path instead
    if ((!trackingPath || trackingPath.length < 3) && selectedRouteRef.current && 
        selectedRouteRef.current.pathCoordinates && selectedRouteRef.current.pathCoordinates.length >= 3) {
      console.log("Using route coordinates instead of tracking path");
      pathToUse = selectedRouteRef.current.pathCoordinates;
    } else if (!trackingPath || trackingPath.length < 3) {
      alert('Not enough tracking points to save a route.');
      console.error("Insufficient tracking points:", trackingPath);
      return;
    }
    
    try {
      // Create a title with timestamp to ensure uniqueness
      const routeTitle = prompt(
        'Enter a name for this simulated route:', 
        `Simulated ${selectedRoute ? selectedRoute.title : 'Route'} - ${new Date().toLocaleTimeString()}`
      );
      
      if (!routeTitle) {
        return; // User cancelled
      }
      
      // Get distance from tracking stats or route
      const routeDistance = Math.max(0.01, 
                                    trackingStatsRef.current.distance || 
                                    (selectedRouteRef.current ? selectedRouteRef.current.distance : 0) || 0);
      
      // Get start, mid, and end points
      const firstPoint = pathToUse[0];
      const lastPoint = pathToUse[pathToUse.length - 1];
      
      console.log("Route points being saved - first:", firstPoint, "last:", lastPoint, "total:", pathToUse.length);
      
      // Create a simplified path if too many points (to avoid payload size issues)
      if (pathToUse.length > 100) {
        // Simplify by taking every nth point to keep under 100 points
        const step = Math.ceil(pathToUse.length / 100);
        const simplifiedPath = pathToUse.filter((_, index) => index % step === 0 || index === pathToUse.length - 1);
        
        // Always ensure we keep first and last point
        if (!simplifiedPath.includes(firstPoint)) simplifiedPath.unshift(firstPoint);
        if (!simplifiedPath.includes(lastPoint)) simplifiedPath.push(lastPoint);
        
        pathToUse = simplifiedPath;
        console.log("Path simplified to", pathToUse.length, "points");
      }
      
      // Format path coordinates correctly for GeoJSON
      // GeoJSON requires [longitude, latitude] format
      const pathCoordinates = pathToUse.map(point => {
        // Ensure point is valid
        if (!Array.isArray(point) || point.length < 2 || 
            isNaN(point[0]) || isNaN(point[1])) {
          console.warn('Skipping invalid point:', point);
          return null;
        }
        
        // Convert from [latitude, longitude] to [longitude, latitude]
        return [point[1], point[0]];
      }).filter(point => point !== null);
      
      // Ensure we still have enough valid points after filtering
      if (pathCoordinates.length < 3) {
        alert('Error: Not enough valid coordinates in path. Need at least 3 points.');
        console.error("Invalid coordinates after filtering:", pathCoordinates);
        return;
      }
      
      // Create route data with all required fields
      const routeData = {
        title: routeTitle,
        description: `Simulated route on ${new Date().toLocaleDateString()}`,
        distance: routeDistance,
        elevationGain: 0,
        // Create path as object
        path: {
          type: 'LineString',
          coordinates: pathCoordinates
        },
        // Create start and end points
        startPoint: {
          type: 'Point',
          coordinates: [firstPoint[1], firstPoint[0]]
        },
        endPoint: {
          type: 'Point',
          coordinates: [lastPoint[1], lastPoint[0]]
        },
        completed: true // Automatically mark simulated routes as completed
      };
      
      // Get token and save the route
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Error: You must be logged in to save routes');
        return;
      }
      
      console.log("Saving route data:", routeData);
      
      saveRoute(token, routeData)
        .then(result => {
          if (result.success) {
            alert('Simulated route saved successfully!');
            fetchRoutes();
          } else {
            alert('Failed to save route: ' + (result.message || 'Unknown server error'));
            console.error('Route save failed:', result);
          }
        })
        .catch(err => {
          console.error('Error saving route:', err);
          alert('Error saving route: ' + (err.message || 'Unknown error occurred'));
        });
    } catch (error) {
      console.error('Error preparing route data:', error);
      alert('Error preparing route data: ' + error.message);
    }
  };

  // Function to save simulated route as an activity
  const saveSimulatedRouteAsActivity = async () => {
    console.log("Attempting to save activity with tracking points:", trackingPath ? trackingPath.length : 0);
    
    // Use the original route path if tracking path is insufficient
    let pathToUse = trackingPath;
    
    // If tracking path is too short but we have a route with valid coordinates, use the route's path instead
    if ((!trackingPath || trackingPath.length < 3) && selectedRouteRef.current && 
        selectedRouteRef.current.pathCoordinates && selectedRouteRef.current.pathCoordinates.length >= 3) {
      console.log("Using route coordinates instead of tracking path");
      pathToUse = selectedRouteRef.current.pathCoordinates;
    } else if (!trackingPath || trackingPath.length < 3) {
      alert('Not enough tracking points to save an activity.');
      console.error("Insufficient tracking points:", trackingPath);
      return;
    }
    
    try {
      // Create a title with timestamp to ensure uniqueness
      const activityTitle = prompt(
        'Enter a name for this activity:', 
        `${selectedRoute ? selectedRoute.title : 'Route'} - ${new Date().toLocaleTimeString()}`
      );
      
      if (!activityTitle) {
        return; // User cancelled
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Error: You must be logged in to save activities');
        return;
      }
      
      // Get distance from tracking stats or calculate it from coordinates
      let finalDistance = trackingStatsRef.current.distance;
      
      // If distance is missing or invalid, calculate it
      if (!finalDistance || finalDistance <= 0) {
        console.log("Recalculating distance for simulated activity");
        finalDistance = calculateRouteDistance(pathToUse);
        
        // Log the calculated distance
        console.log("Calculated distance:", finalDistance);
      }
      
      // Ensure minimum valid distance
      finalDistance = Math.max(0.001, finalDistance);
      console.log("Final distance for activity:", finalDistance);
      
      // Get duration from tracking stats
      const duration = trackingStatsRef.current.duration || 60; // Minimum 1 minute
      
      // Calculate timestamps for each point based on duration
      const startTime = trackingStartTimeRef.current || Date.now() - (duration * 1000);
      const timePerPoint = duration * 1000 / pathToUse.length;
      
      // Format location history for the API with proper timestamps and coordinates
      const locationHistory = pathToUse.map((point, index) => ({
        timestamp: new Date(startTime + (index * timePerPoint)),
        coordinates: [point[1], point[0]], // Convert from [lat, lng] to [lng, lat]
        speed: parseFloat(trackingStatsRef.current.speed) || 5 // Default speed if not available
      }));
      
      console.log("Starting session with initial location:", [pathToUse[0][1], pathToUse[0][0]]);
      
      // First start a session (required by the API flow)
      const startResponse = await startSessionWithActivityType(token, {
        initialLocation: {
          coordinates: [pathToUse[0][1], pathToUse[0][0]] // First point [lng, lat]
        },
        activityType: activityType // Use selected activity type
      });
      
      if (!startResponse.success) {
        console.error("Failed to start session:", startResponse.message);
        alert(`Error starting session: ${startResponse.message}`);
        return;
      }
      
      console.log("Session started successfully, now stopping to create activity");
      
      // Extract the last point for final location
      const lastPoint = pathToUse[pathToUse.length - 1];
      
      // Calculate speed based on distance and duration
      const avgSpeed = parseFloat(trackingStatsRef.current.speed) || (finalDistance / (duration / 3600));
      
      // Immediately stop the session to create the activity
      const stopResponse = await stopSession(token, {
        finalLocation: {
          coordinates: [lastPoint[1], lastPoint[0]] // Last point [lng, lat]
        },
        locationHistory: locationHistory.map(item => ({
          timestamp: item.timestamp,
          location: {
            type: 'Point',
            coordinates: item.coordinates
          },
          speed: item.speed
        })),
        totalDistance: finalDistance,
        totalDuration: duration,
        title: activityTitle,
        activityType: activityType, // Use selected activity type
        // Convert the route for the API
        route: {
          type: 'LineString',
          coordinates: pathToUse.map(point => [point[1], point[0]])
        },
        averageSpeed: avgSpeed,
        maxSpeed: parseFloat(avgSpeed) * 1.2 || 10,
        simulated: true // Mark activity as simulated
      });
      
      if (stopResponse.success) {
        alert('Activity saved successfully!');
        console.log("Activity created:", stopResponse.data?.activity?._id);
        // Optionally reload routes
        fetchRoutes();
      } else {
        console.error("Failed to create activity:", stopResponse);
        alert(`Error saving activity: ${stopResponse.message}`);
      }
    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Error saving activity: ' + error.message);
    }
  };

  // Add a function to handle resetting the session
  const handleResetSession = async () => {
    if (window.confirm('Are you sure you want to reset the current session? This will clear any ongoing tracking data.')) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('You must be logged in to reset a session');
          return;
        }
        
        // Stop tracking if currently tracking
        if (isTracking) {
          // Clear tracking timers
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          
          // Stop location watching safely
          if (locationWatchId.current !== null) {
            try {
              navigator.geolocation.clearWatch(locationWatchId.current);
            } catch (e) {
              console.error("Error clearing location watch:", e);
            }
            locationWatchId.current = null;
          }
          
          setIsTracking(false);
        }
        
        // Call the API to reset the session
        const result = await resetSession(token);
        
        if (result.success) {
          alert('Session reset successfully');
          
          // Reset tracking stats
          setTrackingStats({
            distance: 0,
            duration: 0,
            speed: 0,
            startTime: null
          });
          setElapsedTime('00:00:00');
          setTrackingPath([]);
          
          // Reset tracking refs
          trackingStatsRef.current = {
            distance: 0,
            duration: 0,
            speed: 0,
            startTime: null,
            lastSyncTime: null
          };
        } else {
          alert('Failed to reset session: ' + result.message);
        }
      } catch (error) {
        console.error('Error resetting session:', error);
        alert('Error resetting session: ' + error.message);
      }
    }
  };

  // Add this function to handle activity type change
  const handleActivityTypeChange = (e) => {
    setActivityType(e.target.value);
  };

  // Add a function to handle manual route creation form submission
  const handleManualRouteCreate = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first to create routes');
        return;
      }
      
      // Validate inputs
      if (!manualRoute.title || manualRoute.path.coordinates.length < 2) {
        alert('Please provide a title and at least 2 path coordinates');
        return;
      }
      
      // Call the API to create the route
      const result = await createRouteManually(token, manualRoute);
      
      if (result.success) {
        alert('Route created successfully!');
        // Clean up all form-related state
        setShowManualCreateForm(false);
        setIsRoutePinMode(false);
        setRoutePinType(null);
        
        // Remove any minimized form class
        const formElement = document.querySelector('.manual-route-form');
        if (formElement) {
          formElement.classList.remove('minimized');
        }
        
        // Process the created route for display
        const createdRoute = result.data;
        
        // Process path coordinates
        let pathCoordinates = [];
        let startPoint = currentPosition;
        let endPoint = currentPosition;
        
        if (createdRoute.path && createdRoute.path.coordinates) {
          pathCoordinates = createdRoute.path.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        if (createdRoute.startPoint && createdRoute.startPoint.coordinates) {
          startPoint = [
            createdRoute.startPoint.coordinates[1], 
            createdRoute.startPoint.coordinates[0]
          ];
        }
        
        if (createdRoute.endPoint && createdRoute.endPoint.coordinates) {
          endPoint = [
            createdRoute.endPoint.coordinates[1], 
            createdRoute.endPoint.coordinates[0]
          ];
        }
        
        const processedRoute = {
          ...createdRoute,
          pathCoordinates,
          startPoint,
          endPoint
        };
        
        // Display the new route
        setSelectedRoute(processedRoute);
        setShowRouteInfo(true);
        
        // Force map redraw to ensure route is displayed
        setMapKey(Date.now());
        
        // Reset the form
        setManualRoute({
          title: '',
          description: '',
          distance: 0,
          elevationGain: 0,
          isPublic: true,
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
      } else {
        alert('Failed to create route: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error creating route:', err);
      alert('Error creating route: ' + err.message);
    }
  };

  // Add helper function to update coordinates in the manual route form
  const handleCoordinateChange = (type, index, coordIndex, value) => {
    const updatedRoute = { ...manualRoute };
    
    if (type === 'path') {
      // Ensure path coordinates array exists and has enough elements
      if (!updatedRoute.path.coordinates[index]) {
        updatedRoute.path.coordinates[index] = [0, 0];
      }
      updatedRoute.path.coordinates[index][coordIndex] = parseFloat(value) || 0;
    } else if (type === 'start') {
      updatedRoute.startPoint.coordinates[coordIndex] = parseFloat(value) || 0;
    } else if (type === 'end') {
      updatedRoute.endPoint.coordinates[coordIndex] = parseFloat(value) || 0;
    }
    
    // Update the route distance
    updatedRoute.distance = calculateManualRouteDistance(updatedRoute);
    setManualRoute(updatedRoute);
  };

  // Add helper to add new coordinate pair to the path
  const addPathCoordinate = () => {
    const updatedRoute = {
      ...manualRoute,
      path: {
        ...manualRoute.path,
        coordinates: [...manualRoute.path.coordinates, [0, 0]]
      }
    };
    
    setManualRoute(updatedRoute);
  };

  // Add helper to remove a coordinate pair from the path
  const removePathCoordinate = (index) => {
    const updatedCoordinates = [...manualRoute.path.coordinates];
    updatedCoordinates.splice(index, 1);
    
    const updatedRoute = {
      ...manualRoute,
      path: {
        ...manualRoute.path,
        coordinates: updatedCoordinates
      }
    };
    
    // Update the route distance after removing a point
    updatedRoute.distance = calculateManualRouteDistance(updatedRoute);
    setManualRoute(updatedRoute);
  };

  // Add helper to use current location
  const addCurrentLocation = (type) => {
    if (!currentPosition) {
      alert('Current location not available');
      return;
    }
    
    const updatedRoute = { ...manualRoute };
    
    if (type === 'start') {
      updatedRoute.startPoint.coordinates = [currentPosition[1], currentPosition[0]]; // [lng, lat]
    } else if (type === 'end') {
      updatedRoute.endPoint.coordinates = [currentPosition[1], currentPosition[0]]; // [lng, lat]
    } else if (type === 'path') {
      updatedRoute.path.coordinates.push([currentPosition[1], currentPosition[0]]); // [lng, lat]
    }
    
    // Update the route distance
    updatedRoute.distance = calculateManualRouteDistance(updatedRoute);
    setManualRoute(updatedRoute);
  };
  
  // Add a function to calculate the distance of the manual route
  const calculateManualRouteDistance = (route) => {
    // Create full route path
    const fullPath = [];
    
    // Add start point if valid
    if (route.startPoint.coordinates[0] !== 0 || route.startPoint.coordinates[1] !== 0) {
      fullPath.push([
        route.startPoint.coordinates[1], // Convert to [lat, lng] for calculation
        route.startPoint.coordinates[0]
      ]);
    }
    
    // Add all path waypoints
    if (route.path.coordinates.length > 0) {
      for (const coord of route.path.coordinates) {
        fullPath.push([coord[1], coord[0]]); // Convert to [lat, lng]
      }
    }
    
    // Add end point if valid and different from last path point
    if (route.endPoint.coordinates[0] !== 0 || route.endPoint.coordinates[1] !== 0) {
      const endPoint = [route.endPoint.coordinates[1], route.endPoint.coordinates[0]];
      
      // Only add if different from the last point
      const lastPoint = fullPath.length > 0 ? fullPath[fullPath.length - 1] : null;
      if (!lastPoint || endPoint[0] !== lastPoint[0] || endPoint[1] !== lastPoint[1]) {
        fullPath.push(endPoint);
      }
    }
    
    // Calculate the distance using the route coordinates
    return calculateRouteDistance(fullPath);
  };

  if (loading && !currentPosition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-green-600 text-xl">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full relative overflow-hidden ${isRoutePinMode ? 'map-pin-cursor' : ''}`}>
      {/* Map styles - moved from style jsx to style tags */}
      <style>
        {`
          .leaflet-container {
            height: 100% !important;
            width: 100% !important;
            z-index: 10;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
          .leaflet-control-container {
            z-index: 20;
          }
          /* Make sure map panes don't clip content */
          .leaflet-map-pane,
          .leaflet-tile,
          .leaflet-marker-icon,
          .leaflet-marker-shadow,
          .leaflet-tile-pane,
          .leaflet-overlay-pane,
          .leaflet-shadow-pane,
          .leaflet-marker-pane,
          .leaflet-popup-pane,
          .leaflet-overlay-pane svg {
            position: absolute;
            overflow: visible !important;
          }
          /* Ensure path elements don't get clipped */
          .leaflet-overlay-pane svg path {
            pointer-events: auto;
            vector-effect: non-scaling-stroke;
          }
          .button-with-tooltip {
            position: relative;
          }
          .button-with-tooltip:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 100;
            margin-bottom: 5px;
          }
          .map-pin-cursor {
            cursor: crosshair !important;
          }
          .live-tracking-pulse {
            box-shadow: 0 0 0 rgba(142, 36, 170, 0.4);
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(142, 36, 170, 0.4);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(142, 36, 170, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(142, 36, 170, 0);
            }
          }
          @keyframes dash {
            to {
              stroke-dashoffset: -20;
            }
          }
          .leaflet-interactive {
            animation: dash 1.5s linear infinite;
          }
          /* Simulation mode styles */
          .simulation-marker {
            border: 3px solid #FF9800;
            animation: pulse-orange 1.5s infinite;
          }
          @keyframes pulse-orange {
            0% {
              box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(255, 152, 0, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(255, 152, 0, 0);
            }
          }
          .simulation-active-banner {
            position: fixed;
            top: 55px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(255, 152, 0, 0.9);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: fade-in-out 2s infinite alternate;
          }
          @media (min-width: 768px) {
            .simulation-active-banner {
              top: 70px;
              padding: 5px 15px;
              font-size: 12px;
            }
          }
          @keyframes fade-in-out {
            from { opacity: 0.7; }
            to { opacity: 1; }
          }
        `}
      </style>
      
      {/* Map container */}
      <div 
        className={`absolute inset-0 ${isPinningLocation ? 'map-pin-cursor' : ''}`}
        id="map-container"
        ref={mapContainerRef}
        style={{ height: '100%', width: '100%', position: 'relative' }}
      >
        <MapContainer
          key={`map-container-${mapKey}`}
          center={currentPosition}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
          minZoom={10}
          maxZoom={18}
          whenReady={(map) => {
            console.log('Map is ready, key:', mapKey);
          }}
          whenCreated={(map) => {
            // Make sure any old map instance is properly removed
            try {
              if (mapRef && typeof mapRef.remove === 'function') {
                mapRef.off();
                mapRef._handlers.forEach(handler => handler.disable());
                mapRef.remove();
              }
            } catch (e) {
              console.error('Error cleaning up old map:', e);
            }
          }}
        >
          <MapController setMapRef={setMapRef} routeKey={mapKey} />
          <MapClickHandler />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* User current location */}
          <Marker 
            position={currentPosition}
            icon={isSimulating ? 
              new L.DivIcon({
                className: 'simulation-marker',
                html: `<div style="background-color: #FF9800; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white;"><i class="fas fa-running"></i></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              }) : 
              new L.Icon.Default()
            }
          >
            <Popup>{isSimulating ? 'Simulated position' : 'You are here'}</Popup>
          </Marker>
          
          {/* Live tracking path */}
          {isTracking && trackingPath.length > 1 && (
            <Polyline 
              positions={trackingPath}
              color="#F59E0B"
              weight={5}
              opacity={0.8}
            />
          )}
          
          {/* Selected route */}
          {selectedRoute && selectedRoute.pathCoordinates && selectedRoute.pathCoordinates.length >= 2 && (
            <RouteDisplay 
              key={`route-display-${mapKey}-${selectedRoute._id || 'current'}`} 
              route={selectedRoute} 
              currentPosition={currentPosition}
              isTracking={isTracking}
            />
          )}
          
          {/* Manual route preview when in manual route creation mode */}
          {showManualCreateForm && <ManualRoutePreview manualRoute={manualRoute} />}
        </MapContainer>
      </div>
      
      {/* Top Control Bar - with higher z-index */}
      <div className="absolute top-4 left-0 right-0 z-50 px-2 md:px-4 flex justify-between items-center pointer-events-none">
        
        
        <div className="flex space-x-1 md:space-x-2 pointer-events-auto ml-auto">
          <button 
            onClick={() => {
              setIsPinningLocation(!isPinningLocation);
              setShowGenerateForm(false);
              setShowRoutesList(false);
            }}
            className={`button-with-tooltip flex items-center justify-center w-8 h-8 md:w-10 md:h-10 ${isPinningLocation ? 'bg-blue-700' : 'bg-blue-600'} hover:bg-blue-700 text-white rounded-full shadow-lg`}
            data-tooltip="Pin Location"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button 
            onClick={resetToCurrentLocation}
            className="button-with-tooltip flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg"
            data-tooltip="My Location"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button 
            onClick={() => {
              setShowGenerateForm(!showGenerateForm);
              setShowRoutesList(false);
              setIsPinningLocation(false);
              setShowManualCreateForm(false);
            }}
            className={`button-with-tooltip flex items-center justify-center w-8 h-8 md:w-10 md:h-10 ${showGenerateForm ? 'bg-green-700' : 'bg-green-600'} hover:bg-green-700 text-white rounded-full shadow-lg`}
            data-tooltip="Generate Route"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button 
            onClick={() => {
              // Initialize new route when opening the form
              if (!showManualCreateForm) {
                initializeManualRoute();
                
                // Ensure the form is properly displayed and not in a minimized state
                setTimeout(() => {
                  const formElement = document.querySelector('.manual-route-form');
                  if (formElement) {
                    formElement.classList.remove('minimized');
                  }
                }, 10);
              }
              
              // Reset state when toggling the form
              setShowManualCreateForm(!showManualCreateForm);
              setShowGenerateForm(false);
              setShowRoutesList(false);
              setIsPinningLocation(false);
              setIsRoutePinMode(false);
              setRoutePinType(null);
            }}
            className={`button-with-tooltip flex items-center justify-center w-8 h-8 md:w-10 md:h-10 ${showManualCreateForm ? 'bg-indigo-700' : 'bg-indigo-600'} hover:bg-indigo-700 text-white rounded-full shadow-lg`}
            data-tooltip="Manual Create"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
            </svg>
          </button>
          
          
          
          <button 
            onClick={() => {
              setShowRoutesList(!showRoutesList);
              setShowGenerateForm(false);
              setIsPinningLocation(false);
            }}
            className={`button-with-tooltip flex items-center justify-center w-8 h-8 md:w-10 md:h-10 ${showRoutesList ? 'bg-purple-700' : 'bg-purple-600'} hover:bg-purple-700 text-white rounded-full shadow-lg`}
            data-tooltip="My Routes"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path d="M5.625 3.75a2.625 2.625 0 100 5.25h12.75a2.625 2.625 0 000-5.25H5.625zM3.75 11.25a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5H3.75zM3 15.75a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75zM3.75 18.75a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5H3.75z" />
            </svg>
          </button>
          
          <button 
            onClick={() => refreshMap()}
            className="button-with-tooltip flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-gray-600 hover:bg-gray-700 text-white rounded-full shadow-lg"
            data-tooltip="Refresh Map"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
            </svg>
          </button>
      
          {/* New Clear Route Button */}
        <button 
            onClick={clearCurrentRoute}
            className={`button-with-tooltip flex items-center justify-center w-8 h-8 md:w-10 md:h-10 ${selectedRoute ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-full shadow-lg`}
            data-tooltip="Clear Route"
            disabled={!selectedRoute}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
              </svg>
          </button>
        </div>
      </div>
      
      {/* Simulation Active Banner */}
      {isSimulating && (
        <div className="simulation-active-banner text-xs md:text-sm whitespace-nowrap">
          SIMULATION MODE - Speed: {simulationSpeed}x
        </div>
      )}
      
      {/* Integrated tracking panel, no separate live tracking panel needed */}
      
      {/* Route Generation Panel (Floating) - with higher z-index */}
      {showGenerateForm && (
        <div className="absolute top-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white z-50 rounded-lg shadow-lg p-4 pointer-events-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">Generate Route</h3>
            <button onClick={() => setShowGenerateForm(false)} className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Route Type</label>
            <select 
              value={routeType}
              onChange={(e) => setRouteType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
            >
              <option value="short">Short Route (2-3km)</option>
              <option value="long">Long Route (5-10km)</option>
              <option value="loop">Loop Route (Returns to Start)</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Distance (km)</label>
            <input 
              type="number" 
              value={maxDistance}
              onChange={(e) => setMaxDistance(Math.max(1, Math.min(20, Number(e.target.value))))}
              min="1" 
              max="20"
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
            />
          </div>
          
          <button 
            onClick={handleGenerateRoute}
            disabled={generatingRoute}
            className={`w-full py-2 px-4 bg-green-600 text-white rounded-md font-medium ${
              generatingRoute ? 'opacity-70 cursor-wait' : 'hover:bg-green-700'
            }`}
          >
            {generatingRoute ? 'Generating...' : 'Generate Route'}
          </button>
        </div>
      )}
      
      {/* Manual Route Creation Form */}
      {showManualCreateForm && (
        <div className="manual-route-form absolute top-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white z-50 rounded-lg shadow-lg p-4 max-h-[80vh] overflow-y-auto pointer-events-auto transition-all duration-300">
                        <style jsx>{`
                .manual-route-form.minimized {
                  transform: translateY(calc(100% - 40px));
                  max-height: 40px;
                  overflow: hidden;
                }
                .manual-route-form.minimized .form-header {
                  margin-bottom: 0;
                }
                @media (max-width: 768px) {
                  .manual-route-form.minimized {
                    right: auto;
                    width: auto;
                    max-width: 200px;
                    border-top-left-radius: 0;
                    border-bottom-left-radius: 0;
                    left: 0;
                  }
                }
                .manual-route-form.minimized .pinning-active-indicator {
                  display: flex;
                  position: absolute;
                  right: -10px;
                  top: 10px;
                  width: 12px;
                  height: 12px;
                  background-color: #FF4136;
                  border-radius: 50%;
                  animation: pulse-red 1.5s infinite;
                }
                @keyframes pulse-red {
                  0% {
                    transform: scale(0.95);
                    box-shadow: 0 0 0 0 rgba(255, 65, 54, 0.7);
                  }
                  70% {
                    transform: scale(1.1);
                    box-shadow: 0 0 0 10px rgba(255, 65, 54, 0);
                  }
                  100% {
                    transform: scale(0.95);
                    box-shadow: 0 0 0 0 rgba(255, 65, 54, 0);
                  }
                }
              `}</style>
          <div className="form-header flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">
              Create Route Manually
              {isRoutePinMode && <span className="pinning-active-indicator ml-2"></span>}
            </h3>
            <div className="flex space-x-2">
              {/* Button to restore form from minimized state */}
              <button
                onClick={() => {
                  const formElement = document.querySelector('.manual-route-form');
                  if (formElement) {
                    formElement.classList.remove('minimized');
                    // Make sure we don't lose the reference to the form
                    if (!formElement.classList.contains('minimized') && !showManualCreateForm) {
                      setShowManualCreateForm(true);
                    }
                  }
                }}
                className="text-blue-500 hover:text-blue-700 minimize-restore-btn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Close/Minimize button */}
              <button 
                onClick={() => {
                  // Check if pinning mode is active before closing
                  if (isRoutePinMode) {
                    // Keep the form open but minimize it if in pin mode
                    const formElement = document.querySelector('.manual-route-form');
                    if (formElement) {
                      formElement.classList.add('minimized');
                    }
                  } else {
                    // If not in pin mode, close the form normally
                    setShowManualCreateForm(false);
                    // Make sure to clean up pin mode state
                    setIsRoutePinMode(false);
                    setRoutePinType(null);
                    
                    // Make sure the form is not minimized for the next time it's opened
                    setTimeout(() => {
                      const formElement = document.querySelector('.manual-route-form');
                      if (formElement) {
                        formElement.classList.remove('minimized');
                      }
                    }, 100);
                  }
                }} 
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          
          {isRoutePinMode && (
            <div className="bg-yellow-100 p-3 rounded-md mb-3 flex justify-between items-center">
              <div className="text-sm text-yellow-800">
                <strong>Pin Mode Active:</strong> Click on the map to add a {routePinType === 'start' ? 'start point' : routePinType === 'end' ? 'end point' : 'waypoint'}
              </div>
              <button 
                onClick={() => {
                  setIsRoutePinMode(false);
                  setRoutePinType(null);
                }}
                className="text-xs py-1 px-2 bg-yellow-700 text-white rounded hover:bg-yellow-800"
              >
                Cancel
              </button>
            </div>
          )}
          
          <form onSubmit={handleManualRouteCreate}>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={manualRoute.title}
                onChange={(e) => setManualRoute({...manualRoute, title: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Route title"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={manualRoute.description}
                onChange={(e) => setManualRoute({...manualRoute, description: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Description"
                rows="2"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distance (km) <span className="text-xs font-normal text-gray-500">(Auto-calculated: {manualRoute.distance.toFixed(2)}km)</span>
                </label>
                <input
                  type="number"
                  value={manualRoute.distance}
                  onChange={(e) => setManualRoute({...manualRoute, distance: parseFloat(e.target.value) || 0})}
                  min="0"
                  step="0.1"
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Distance is calculated automatically when you add/modify points, but you can adjust it if needed.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Elevation (m)</label>
                <input
                  type="number"
                  value={manualRoute.elevationGain}
                  onChange={(e) => setManualRoute({...manualRoute, elevationGain: parseFloat(e.target.value) || 0})}
                  min="0"
                  step="1"
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            
            <div className="mb-3">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={manualRoute.isPublic}
                    onChange={(e) => setManualRoute({...manualRoute, isPublic: e.target.checked})}
                    className="mr-2"
                  />
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">Public Route</label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="connectWaypoints"
                    checked={isConnectWaypoints}
                    onChange={(e) => setIsConnectWaypoints(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="connectWaypoints" className="text-sm font-medium text-gray-700">
                    Auto-connect waypoints
                    <span className="ml-1 text-xs text-gray-500">(Coming soon)</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Start Point</h3>
              <div className="flex flex-col space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1">Longitude</label>
                    <input
                      type="number"
                      value={manualRoute.startPoint.coordinates[0]}
                      onChange={(e) => handleCoordinateChange('start', 0, 0, e.target.value)}
                      step="0.0001"
                      className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Latitude</label>
                    <input
                      type="number"
                      value={manualRoute.startPoint.coordinates[1]}
                      onChange={(e) => handleCoordinateChange('start', 0, 1, e.target.value)}
                      step="0.0001"
                      className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-xs"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addCurrentLocation('start')}
                    className="py-1 px-2 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600"
                  >
                    Use Current Location
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoutePinMode(true);
                      setRoutePinType('start');
                    }}
                    className={`py-1 px-2 ${isRoutePinMode && routePinType === 'start' ? 'bg-green-600' : 'bg-purple-600'} text-white rounded-md text-xs hover:bg-purple-700`}
                  >
                    Pin on Map
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <h3 className="text-sm font-medium text-gray-700 mb-1">End Point</h3>
              <div className="flex flex-col space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1">Longitude</label>
                    <input
                      type="number"
                      value={manualRoute.endPoint.coordinates[0]}
                      onChange={(e) => handleCoordinateChange('end', 0, 0, e.target.value)}
                      step="0.0001"
                      className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Latitude</label>
                    <input
                      type="number"
                      value={manualRoute.endPoint.coordinates[1]}
                      onChange={(e) => handleCoordinateChange('end', 0, 1, e.target.value)}
                      step="0.0001"
                      className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-xs"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => addCurrentLocation('end')}
                    className="py-1 px-2 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600"
                  >
                    Use Current Location
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoutePinMode(true);
                      setRoutePinType('end');
                    }}
                    className={`py-1 px-2 ${isRoutePinMode && routePinType === 'end' ? 'bg-green-600' : 'bg-purple-600'} text-white rounded-md text-xs hover:bg-purple-700`}
                  >
                    Pin on Map
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-medium text-gray-700">Path Coordinates</h3>
                <button
                  type="button"
                  onClick={addPathCoordinate}
                  className="py-1 px-2 bg-green-500 text-white text-xs rounded-md hover:bg-green-600"
                >
                  Add Point
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => addCurrentLocation('path')}
                  className="py-1 px-2 bg-blue-500 text-white rounded-md text-xs hover:bg-blue-600"
                >
                  Add Current Location
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setIsRoutePinMode(true);
                    setRoutePinType('path');
                  }}
                  className={`py-1 px-2 ${isRoutePinMode && routePinType === 'path' ? 'bg-green-600' : 'bg-purple-600'} text-white rounded-md text-xs hover:bg-purple-700`}
                >
                  {isRoutePinMode && routePinType === 'path' ? 'Cancel Pin Mode' : 'Pin on Map'}
                </button>
              </div>
              
              {isRoutePinMode && routePinType === 'path' && (
                <div className="bg-yellow-100 p-2 rounded-md mb-2">
                  <p className="text-xs text-yellow-800">
                    <strong>Click on the map</strong> to add waypoints. Click "Cancel Pin Mode" when done.
                  </p>
                </div>
              )}
              
              <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                {manualRoute.path.coordinates.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-2">No path points added</p>
                ) : (
                  <div className="space-y-2">
                    {manualRoute.path.coordinates.map((coord, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <span className="text-xs font-bold">{index + 1}</span>
                        <div className="grid grid-cols-2 gap-1 flex-grow">
                          <input
                            type="number"
                            value={coord[0]}
                            onChange={(e) => handleCoordinateChange('path', index, 0, e.target.value)}
                            step="0.0001"
                            className="w-full p-1 border border-gray-300 rounded-md shadow-sm text-xs"
                            placeholder="Lng"
                          />
                          <input
                            type="number"
                            value={coord[1]}
                            onChange={(e) => handleCoordinateChange('path', index, 1, e.target.value)}
                            step="0.0001"
                            className="w-full p-1 border border-gray-300 rounded-md shadow-sm text-xs"
                            placeholder="Lat"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePathCoordinate(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-1">
                Add at least 2 points for a valid route.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowManualCreateForm(false)}
                className="py-2 px-4 bg-gray-500 text-white rounded-md font-medium hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-4 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700"
              >
                Create Route
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Routes List Panel (Floating) - with higher z-index */}
      {showRoutesList && (
        <div className="absolute top-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white z-50 rounded-lg shadow-lg p-4 max-h-[70vh] overflow-y-auto pointer-events-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">My Routes</h3>
            <button onClick={() => setShowRoutesList(false)} className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Add tabs for All/Completed routes */}
          <div className="flex border-b border-gray-200 mb-3">
                          <button 
                className={`py-2 px-4 text-sm font-medium ${routeListTab === 'all' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setRouteListTab('all');
                  // Refresh route list when tab is selected
                  fetchRoutes();
                }}
              >
                All Routes
              </button>
            <button 
              className={`py-2 px-4 text-sm font-medium ${routeListTab === 'completed' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setRouteListTab('completed')}
            >
              Completed
            </button>
            <button 
              className={`py-2 px-4 text-sm font-medium ${routeListTab === 'nearby' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => {
                setRouteListTab('nearby');
                // Force refresh of nearby routes when tab is selected
                fetchNearbyRoutes();
              }}
            >
              Nearby
            </button>
          </div>
          
          {routeListTab === 'nearby' ? (
            // Nearby routes tab content
            loadingNearby ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700 mb-2"></div>
                <p>Loading nearby routes...</p>
              </div>
            ) : nearbyRoutes.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No routes found near your location.</p>
                <button 
                  onClick={fetchNearbyRoutes}
                  className="mt-2 py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Refresh Nearby Routes
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {nearbyRoutes.map(route => (
                  <div 
                    key={route._id}
                    className="bg-white p-3 border rounded-lg border-gray-200 hover:shadow-md transition-shadow duration-200"
                    onClick={() => handleRouteSelect(route)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <h4 className="font-bold text-gray-800">{route.title || 'Unnamed Route'}</h4>
                        <div className="flex items-start gap-1 mt-0.5">
                          {route.isVerified && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Verified</span>
                          )}
                        </div>
                      </div>
                      {route.user && (
                        <div className="flex items-center text-xs text-gray-600">
                          {route.user.profilePicture ? (
                            <img 
                              src={route.user.profilePicture} 
                              alt={route.user.username || route.user.firstName} 
                              className="w-5 h-5 rounded-full mr-1"
                            />
                          ) : (
                            <div className="w-5 h-5 bg-gray-300 rounded-full mr-1 flex items-center justify-center text-xs text-white">
                              {route.user.firstName?.charAt(0) || route.user.username?.charAt(0) || '?'}
                            </div>
                          )}
                          <span>by {route.user.firstName || route.user.username}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{route.description || 'No description'}</p>
                    
                    {/* Route path visualization with Leaflet map */}
                    <div className="mt-2 relative">
                      <RouteMiniMap route={route} />
                      <div className="absolute top-1 left-1 bg-white bg-opacity-70 rounded px-1 text-xs">
                        {route.distance ? `${route.distance.toFixed(1)} km` : ''}
                      </div>
                    </div>
                    
                    <div className="mt-2 flex justify-between text-xs text-gray-600">
                      <span>Distance: {route.distance || '?'} km</span>
                      <span>Elevation: {route.elevationGain || '?'} m</span>
                    </div>
                    
                    <div className="mt-2 flex justify-between">
                      <button 
                        className="py-1 px-2 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRouteSelect(route);
                        }}
                      >
                        View
                      </button>
                      <button 
                        className="py-1 px-2 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRouteSelect(route);
                          setTimeout(() => toggleTracking(), 100);
                        }}
                      >
                        Start
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={fetchNearbyRoutes}
                  className="w-full py-2 mt-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
                >
                  Refresh Nearby Routes
                </button>
              </div>
            )
          ) : (
            // Original tabs content (All and Completed)
            loading ? (
            <div className="text-center py-8">Loading routes...</div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">{error}</div>
          ) : userRoutes.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <p>No saved routes found.</p>
              <button 
                className="mt-2 py-2 px-4 bg-green-600 text-white rounded-md"
                onClick={() => {
                  setShowRoutesList(false);
                  setShowGenerateForm(true);
                }}
              >
                Generate Your First Route
              </button>
            </div>
          ) : (
            <div className="space-y-3">
                {userRoutes
                  .filter(route => {
                    if (routeListTab === 'all') return true;
                    if (routeListTab === 'completed') return route.completed;
                    return true;
                  })
                  .map(route => (
                <div 
                  key={route._id}
                  className={`bg-white p-3 border rounded-lg ${
                    selectedRoute && selectedRoute._id === route._id ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                  onClick={() => handleRouteSelect(route)}
                >
                  <div className="flex justify-between items-start">
                  <h4 className="font-bold text-gray-800">{route.title || 'Unnamed Route'}</h4>
                    <div className="flex gap-1">
                    {route.completed && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Completed</span>
                    )}
                      {route.isVerified && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Verified</span>
                    )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{route.description || 'No description'}</p>
                  
                  {/* Route path visualization with Leaflet map */}
                  <div className="mt-2 relative">
                    <RouteMiniMap route={route} />
                    <div className="absolute top-1 left-1 bg-white bg-opacity-70 rounded px-1 text-xs">
                      {route.distance ? `${route.distance.toFixed(1)} km` : ''}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex justify-between text-xs text-gray-600">
                    <span>Distance: {route.distance || '?'} km</span>
                    <span>Elevation: {route.elevationGain || '?'} m</span>
                  </div>
                  
                  <div className="mt-2 flex justify-between">
                    <button 
                      className="py-1 px-2 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRouteSelect(route);
                      }}
                    >
                      View
                    </button>
                      {!route.completed && (
                    <button 
                      className="py-1 px-2 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRouteSelect(route);
                        setTimeout(() => toggleTracking(), 100);
                      }}
                    >
                      Start
                    </button>
                      )}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => fetchRoutes()}
                className="w-full py-2 mt-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
              >
                Refresh Routes
              </button>
            </div>
            )
          )}
        </div>
      )}
      
      {/* Pin Location Instructions - show when user is in pinning mode */}
      {isPinningLocation && (
        <div className="absolute top-20 left-4 right-4 z-50 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-4 text-center pointer-events-auto">
          <p className="text-blue-800 font-medium">Tap anywhere on the map to set your location</p>
          <button 
            onClick={() => setIsPinningLocation(false)}
            className="mt-2 py-1 px-3 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Route Info Panel - Updated for tracking state */}
      {showRouteInfo && selectedRoute && (
        <div className="absolute bottom-16 md:bottom-20 left-2 right-2 md:left-4 md:right-4 z-50 bg-white rounded-lg shadow-lg p-3 pointer-events-auto md:left-auto md:right-4 md:w-72">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm">{selectedRoute.title || 'Unnamed Route'}</h3>
            <button onClick={() => setShowRouteInfo(false)} className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex justify-between text-xs my-1">
            <span>Distance: {selectedRoute.distance || calculateRouteDistance(selectedRoute.pathCoordinates).toFixed(2)} km</span>
            <span>Elevation: {selectedRoute.elevationGain || '0'} m</span>
          </div>
          
          {isTracking || isSimulating ? (
            <div className="mt-1">
              <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-xs text-purple-800">
                    {isSimulating ? 'Simulating Route' : isAutoCompleted ? 'Route Completed!' : 'Tracking Route'}
                  </h3>
                  <div className={`h-2 w-2 rounded-full ${isAutoCompleted ? 'bg-green-500' : 'animate-pulse bg-purple-500'}`}></div>
                  {socketRef.current && socketRef.current.connected && (
                    <div className="text-xs text-green-600 flex items-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1"></div>
                      Live
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-1 mb-1">
                  <div className="bg-white p-1 rounded shadow-sm">
                    <div className="text-xs text-gray-500">Time</div>
                    <div className="text-sm font-semibold text-purple-700">{elapsedTime}</div>
                  </div>
                  
                  <div className="bg-white p-1 rounded shadow-sm">
                    <div className="text-xs text-gray-500">Distance</div>
                    <div className="text-sm font-semibold text-purple-700">{trackingStats.distance.toFixed(2)} km</div>
                  </div>
                  
                  <div className="bg-white p-1 rounded shadow-sm">
                    <div className="text-xs text-gray-500">Speed</div>
                    <div className="text-sm font-semibold text-purple-700">{trackingStats.speed} km/h</div>
                  </div>
                  
                  <div className="bg-white p-1 rounded shadow-sm">
                    <div className="text-xs text-gray-500">Progress</div>
                    <div className="text-sm font-semibold text-purple-700">
                      {isSimulating ? 
                        (trackingStats.progress || 0) + '%' :
                        Math.min(100, Math.round((trackingStats.distance / (selectedRoute.distance || 1)) * 100)) + '%'
                      }
                    </div>
                  </div>
                </div>
                
                {isSimulating && (
                  <>
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-purple-600 h-1.5 rounded-full" style={{width: `${trackingStats.progress || 0}%`}}></div>
                      </div>
                      <div className="mt-1 text-xs text-center text-gray-500">
                        {trackingStats.progress ? `${trackingStats.progress}% complete` : 'Initializing...'}
                      </div>
                    </div>
                    
                    <div className="mt-1">
                      <label className="block text-xs text-gray-500 mb-1">Simulation Speed</label>
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => setSimulationSpeed(Math.max(0.5, simulationSpeed - 0.5))}
                          className="px-1 py-0.5 bg-gray-200 rounded text-xs"
                          disabled={simulationSpeed <= 0.5}
                        >
                          -
                        </button>
                        <div className="flex-1 text-center bg-white rounded-md py-0.5 text-xs">
                          {simulationSpeed}x
                        </div>
                        <button 
                          onClick={() => setSimulationSpeed(Math.min(5, simulationSpeed + 0.5))}
                          className="px-1 py-0.5 bg-gray-200 rounded text-xs"
                          disabled={simulationSpeed >= 5}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    
                    {/* Add Save buttons during simulation */}
                    {trackingStats.progress > 0 && trackingPath.length >= 3 && (
                      <div className="mt-1 space-y-1">
                        <button 
                          onClick={saveSimulatedRoute}
                          className="w-full py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium"
                        >
                          Save As Route
                        </button>
                        <button 
                          onClick={saveSimulatedRouteAsActivity}
                          className="w-full py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium"
                        >
                          Save As Activity
                        </button>
                      </div>
                    )}
                  </>
                )}
                
                {/* Add Mark as Done button for auto-completed routes */}
                            {isAutoCompleted ? (
              <button 
                onClick={handleMarkAsDone}
                className="mt-1 w-full py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium"
              >
                Mark as Done
              </button>
            ) : (
              <div className="mt-1 flex space-x-1">
                <button 
                  onClick={isSimulating ? toggleSimulation : toggleTracking}
                  className="flex-1 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium"
                >
                  {isSimulating ? 'Stop Simulation' : 'Stop Tracking'}
                </button>
                
                <button 
                  onClick={handleResetSession}
                  className="flex-1 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs font-medium"
                >
                  Reset
                </button>
              </div>
            )}
              </div>
            </div>
                ) : (
        <div className="mt-1 flex flex-col space-y-1">
          {/* Activity Type Selector */}
          <div className="mb-2">
            <label className="block text-xs text-gray-500 mb-1">Activity Type</label>
            <select 
              value={activityType}
              onChange={handleActivityTypeChange}
              className="w-full p-1 text-xs border border-gray-300 rounded shadow-sm"
            >
              <option value="run">Run</option>
              <option value="jog">Jog</option>
              <option value="walk">Walk</option>
              <option value="cycling">Cycling</option>
              <option value="hiking">Hiking</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="flex space-x-1">
            <button 
              className="flex-1 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
              onClick={toggleTracking}
            >
              Start Route
            </button>
            
            <button 
              className="flex-1 py-1 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600"
              onClick={toggleSimulation}
            >
              Simulate Route
            </button>
          </div>
              
              {/* Only show save button for generated routes or if it doesn't have an ID */}
                        {(!selectedRoute._id || selectedRoute._id.startsWith('generated-')) && (
            <button 
              className="w-full py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600"
              onClick={handleSaveRoute}
            >
              Save Route
            </button>
          )}
          
          {/* Add Reset Session button */}
          <button 
            className="w-full py-1 bg-gray-500 text-white rounded text-xs font-medium hover:bg-gray-600"
            onClick={handleResetSession}
          >
            Reset Session
          </button>
            </div>
          )}
        </div>
      )}
      
      {/* Add a floating button to reopen route info if a route is selected but info panel is closed */}
      {selectedRoute && !showRouteInfo && (
        <div className="absolute bottom-20 md:bottom-24 right-2 md:right-4 z-50 pointer-events-auto">
          <button 
            onClick={() => setShowRouteInfo(true)}
            className="bg-purple-600 text-white p-2 md:p-3 rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700"
            title="Show route details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 md:w-6 md:h-6">
              <path d="M11.625 16.5a1.875 1.875 0 100-3.75 1.875 1.875 0 000 3.75z" />
              <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
              <path d="M3.75 13.5h10.5a.75.75 0 000-1.5H3.75a.75.75 0 000 1.5z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default Home;

// Prevent ESLint warnings
// eslint-disable-next-line no-unused-vars
const unusedVarsCheck = (routeDistance) => routeDistance;

