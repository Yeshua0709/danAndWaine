import { useEffect, useState } from "react";
import Landing from "./Landing.jsx";
import Gallery from "./Gallery.jsx";

const getRoute = () => (window.location.hash === "#gallery" ? "gallery" : "home");

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onChange = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route === "gallery" ? <Gallery /> : <Landing />;
}
