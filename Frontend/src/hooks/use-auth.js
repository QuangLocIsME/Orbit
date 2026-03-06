import { useState } from "react";
import { login as loginApi, register as registerApi } from "../services/auth-service.js";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, password) => {
    const res = await loginApi(username, password);
    setUser(res.user);
    return res;
  };

  const register = async (formData) => {
    try {
      setLoading(true);
      setError(null);
      const res = await registerApi(formData);

      return res;

    } catch (err) {
      setError("Register failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { user, login, register, loading, error };
}