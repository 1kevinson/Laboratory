import { ofetch } from "ofetch";

export const httpClient = ofetch.create({
  baseURL: import.meta.env.VITE_BACKEND_API_BASE_URL ?? '/api'
})
