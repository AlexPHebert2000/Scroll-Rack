import "./App.css";
import Box from '@mui/material/Box'
import {Routes, Route} from 'react-router-dom';
import type { ReactElement } from "react";

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
]

export default App;
