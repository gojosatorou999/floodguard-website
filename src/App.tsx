import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./routes/Home";

/**
 * Only the homepage is scaffolded. Segment/product routes come later —
 * see README §5 for the full sitemap.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
