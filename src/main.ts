import "./app/styles.css";
import { createApp } from "./app/createApp";

const host = document.querySelector<HTMLElement>("#app");

if (!host) {
  throw new Error("BRIDGE LAB could not mount because the #app host is missing.");
}

createApp(host);
