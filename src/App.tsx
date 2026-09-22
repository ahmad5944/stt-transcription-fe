import { useState } from 'react';
import './App.css';
import { DeviceSelection } from './pages/DeviceSelection';
import { Login } from './pages/Login';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));

  if (!accessToken) {
    return <Login onAuthenticated={setAccessToken} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    setAccessToken(null);
  };

  return <DeviceSelection onLogout={handleLogout} />;
}

export default App;

