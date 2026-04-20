import {Routes, Route, useLocation} from 'react-router-dom';
import type { ReactElement } from "react";

import Login from "./components/Login";
import Signup from "./components/Signup";
import Home from "./components/Home";
import Decklist from "./components/Decklist";
import NavBar from "./components/NavBar";

const ROUTES_WITHOUT_NAV = new Set(['/login', '/signup']);

function App() :ReactElement {
  const { pathname } = useLocation();
  return (
    <>
      {!ROUTES_WITHOUT_NAV.has(pathname) && <NavBar />}
      <Routes>
        {routes.map(({path, element}, index) => (
          <Route key={path + index} path={path} element={element}/>
        ))}
      </Routes>
    </>
  );
}

const routes : {path: string, element: ReactElement}[] = [
  {
    path: "/login",
    element: <Login />
  },
  {
    path: "/signup",
    element: <Signup />
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
