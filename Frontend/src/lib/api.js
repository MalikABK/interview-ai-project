import axios from "axios";

const apiClient = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true,
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // Centralized error handling
        const message = error.response?.data?.message || "Something went wrong";
        console.error("API Error:", message);
        // Here you could trigger a Toast notification library (e.g., react-hot-toast)
        return Promise.reject(new Error(message));
    }
);

export default apiClient;
