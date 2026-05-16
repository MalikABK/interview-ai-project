import apiClient from "../../../lib/api"

export async function register({ username, email, password }) {
    const response = await apiClient.post('/api/auth/register', { username, email, password })
    return response.data
}

export async function login({ email, password }) {
    const response = await apiClient.post("/api/auth/login", { email, password })
    return response.data
}

export async function logout() {
    const response = await apiClient.get("/api/auth/logout")
    return response.data
}

export async function getMe() {
    const response = await apiClient.get("/api/auth/get-me")
    return response.data
}