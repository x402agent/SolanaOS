import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SetupPage } from './components/SetupPage';
import SolanaOSApp from './components/SolanaOSApp';

const basename = window.location.pathname.startsWith('/app') ? '/app' : '/';

const App: React.FC = () => (
  <BrowserRouter basename={basename === '/' ? undefined : basename}>
    <Routes>
      <Route path="/" element={<SolanaOSApp />} />
      <Route path="/setup" element={<SetupPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
