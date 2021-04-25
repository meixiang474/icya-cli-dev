"use strict";

const axios = require("axios");
const BASE_URL = process.env.ICYA_CLI_BASE_URL
  ? process.env.ICYA_CLI_BASE_URL
  : "";

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
});

request.interceptors.response.use(
  (res) => {
    if ((res.status >= 200 && res.status < 300) || res.status === 304) {
      return res.data;
    } else {
      return Promise.reject(res);
    }
  },
  (err) => Promise.reject(err)
);

module.exports = request;
