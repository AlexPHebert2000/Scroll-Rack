import {Routes, Route, useLocation} from 'react-router-dom';
import type { ReactElement } from "react";

import Login, { AuthPage } from "./components/Login";
import Home from "./components/Home";
import Decklist from "./components/Decklist";
import NavBar from "./components/NavBar";
import UserProvider from "./contexts/UserContext";

const ROUTES_WITHOUT_NAV = new Set(['/login', '/signup']);

function App() :ReactElement {
  const { pathname } = useLocation();
  return (
    <UserProvider>
      {!ROUTES_WITHOUT_NAV.has(pathname) && <NavBar />}
      <Routes>
        {routes.map(({path, element}, index) => (
          <Route key={path + index} path={path} element={element}/>
        ))}
      </Routes>
    </UserProvider>
  );
}

const routes : {path: string, element: ReactElement}[] = [
  {
    path: "/login",
    element: <Login />
  },
  {
    path: "/signup",
    element: <AuthPage mode="signup" />
  },
  {
    path: "/",
    element: <Home />
  },
  {
    path: "/deck/:id/:branch?/:commit?",
    element: <Decklist />
  }
]

export default App;
