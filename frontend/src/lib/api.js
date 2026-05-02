import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fmtINR = (n) => {
  const v = Number(n || 0);
  return `\u20B9${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const fmtINRShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `\u20B9${(v / 10000000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 100000) return `\u20B9${(v / 100000).toFixed(2)}L`;
  if (Math.abs(v) >= 1000) return `\u20B9${(v / 1000).toFixed(1)}K`;
  return `\u20B9${v.toFixed(0)}`;
};
