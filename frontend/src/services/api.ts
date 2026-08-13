/**
 * FaceAttend — Axios API Client
 *
 * Configured with:
 * - Base URL from env
 * - JWT Bearer token injection
 * - Automatic 401 handling (redirect to login)
 * - Standard error response shape
 */
import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { env } from "@/config/env";

/** Standard FaceAttend API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

/** Standard FaceAttend API error envelope */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, unknown>;
}

const api = axios.create({
  baseURL: env.API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

/** Inject JWT access token from localStorage on every request */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

/** Handle 401 Unauthorized — clear tokens and redirect to login */
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      // Avoid redirect loop on the login page itself
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
