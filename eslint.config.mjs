import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [...coreWebVitals, ...typescript, {
  rules: {
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "react-hooks/purity": "off",
  },
}];

export default config;
