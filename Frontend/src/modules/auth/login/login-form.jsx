import "./login.css";
import { useState } from "react";
import PrimaryButton from "../../project/component/primary-button.jsx";
import TextInput from "../../project/component/text-input.jsx";
import { login } from "../service/auth-service.js";

export default function LoginForm() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await login(form.email, form.password);

      console.log("Login success:", res.data);

      // redirect
      window.location.href = "/home";

    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      {/* LEFT PANEL */}
      <div className="login-visual">
        <div className="visual-content">
          <div className="visual-illustration" />

          <h2>Welcome Back to ORBIT</h2>

          <p>
            Log in to continue managing your BIM construction projects
            efficiently and collaboratively.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="login-form-area">
        <a href="/" className="back-link">← Back</a>

        <h1>Log in</h1>

        <form className="form" onSubmit={handleSubmit}>
          {error && <p className="form-error">{error}</p>}
          <TextInput
            label="Email *"
            type="email"
            placeholder="Enter email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
          />

          <TextInput
            label="Password *"
            type="password"
            placeholder="Enter password"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
          />

          <div className="forgot">
            <a href="/forgot-password">Forgot password?</a>
          </div>

          <button type="button" className="google-btn">
            Continue with Google
          </button>

          <p className="switch">
            Don’t have an account? <a href="/register">Create one</a>
          </p>

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </PrimaryButton>

        </form>
      </div>
    </div>
  );
}