import React from "react";
import { BrowserRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";

import App from "./App";

const queryClient = new QueryClient();

const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#242424" },
  },
  typography: {
    fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
  },
});

const globalStyles = (
  <GlobalStyles styles={{
    ":root": {
      colorScheme: "light dark",
      fontSynthesis: "none",
      textRendering: "optimizeLegibility",
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
      WebkitTextSizeAdjust: "100%",
    },
    body: { minWidth: 320 },
  }} />
);

createRoot(document.getElementById("root") as HTMLElement).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    {globalStyles}
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>
);
