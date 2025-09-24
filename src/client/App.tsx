import "./App.css";
import Box from '@mui/material/Box'
import {Routes, Route} from 'react-router-dom';
import type { ReactElement } from "react";

import Login from "./components/Login";
import Home from "./components/Home";
import Decklist from "./components/Decklist";

function App() :ReactElement {
  return (
    <>
      <Box>
        Scroll Rack
      </Box>
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
    path: "/",
    element: <Home />
  },
  {
    path: "/deck",
    element: <Decklist />
  }
]

export default App;
