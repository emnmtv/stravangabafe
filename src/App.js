import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import './App.css';
import Navigation from './Navigation';
import AppRouter from './router';

// Add CSS to handle fixed navigation spacing
const navStyles = `
  /* Fixed navigation spacing */
  body {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }
  
  #root {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }
  
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
  }
  
  .content-container {
    flex: 1;
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 56px; /* Height of bottom navbar */
    width: 100%;
  }
  
  @media (min-width: 769px) {
    .content-container {
      padding-top: 64px; /* Height of top navbar on desktop */
      padding-bottom: 0;
    }
  }
  
  /* Fix for Home component conflicts */
  .home-container .leaflet-container {
    height: 100% !important;
    width: 100% !important;
    z-index: 1 !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
  }
  
  /* Make sure bottom nav stays above map */
  .bottom-nav {
    z-index: 1001 !important;
    position: fixed !important;
    bottom: 0 !important;
    left: 0 !important;
    width: 100% !important;
  }
`;

// Component to conditionally render Navigation
const AppContent = () => {
  const location = useLocation();
  const path = location.pathname;
  
  // Don't show navigation on landing, login, or register pages
  const hideNavigation = path === '/' || path === '/login' || path === '/register';
  
  // Check if we're on the Home component page
  const isHomePage = path === '/home' || path === '/routes' || path === '/activities';
  
  return (
    <>
      {/* Add global styles for navigation spacing */}
      <style>{navStyles}</style>
      
      <div className={`app-container ${isHomePage ? 'home-container' : ''}`}>
        {!hideNavigation && <Navigation />}
        <div className={hideNavigation ? "full-height" : "content-container"}>
          <AppRouter />
        </div>
      </div>
    </>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
