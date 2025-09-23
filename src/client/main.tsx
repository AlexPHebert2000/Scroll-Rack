import "./index.css";
import React from "react";
import {BrowserRouter} from 'react-router-dom'
import {createRoot} from "react-dom/client";
import {QueryClient, QueryClientProcvider} from '@tanstack/react-query';

import App from "./App";

const queryClient = new QueryClient();

createRoot(document.getElementById("root") as HTMLElement).render(
  <QueryClientProcvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  </QueryClientProcvider>
);
