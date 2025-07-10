import { useState, useEffect } from 'react';

function App() {
  const [health, setHealth] = useState('Checking...');
  const [healthColor, setHealthColor] = useState('text-gray-500');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        if (data.status === 'ok') {
          setHealth('OK');
          setHealthColor('text-green-600');
        } else {
          setHealth('Error');
          setHealthColor('text-red-600');
        }
      })
      .catch(() => {
        setHealth('Error');
        setHealthColor('text-red-600');
      });
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Admin Dashboard</h1>
        <p className="text-lg text-gray-600">UI implementation has begun. More features to come.</p>
        <p className="mt-4 text-sm text-gray-500">
          API Health: <span className={`${healthColor} font-bold`}>{health}</span>
        </p>
      </div>
    </div>
  )
}

export default App
