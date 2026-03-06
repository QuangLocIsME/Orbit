// import "../../styles/login.css";
// export default function LoginForm() {
//     return (
//       <div className="login-card">
  
//         {/* LEFT PANEL */}
//         <div className="login-visual">
  
//           <div className="visual-content">
//             <div className="visual-illustration" />
  
//             <h2>Join the BIM Revolution</h2>
  
//             <p>
//               Get started with ORBIT and transform how your team
//               collaborates on construction projects
//             </p>
//           </div>
  
//         </div>
  
//         {/* RIGHT PANEL */}
//         <div className="login-form-area">
  
//           <a href="/" className="back-link">← Back</a>
  
//           <h1>Create your account</h1>
  
//           <form className="form">
  
//             <label>Full name *</label>
//             <input type="text" placeholder="Enter username" />
  
//             <label>Password *</label>
//             <input type="password" placeholder="Enter password" />
  
//             <div className="forgot">
//               <a href="#">Forgot password</a>
//             </div>
  
//             <button type="button" className="google-btn">
//               Continue with Google
//             </button>
  
//             <p className="switch">
//               Don’t have account? <a href="/register">Create one</a>
//             </p>
  
//             <button type="submit" className="primary-btn">
//               Log in
//             </button>
  
//           </form>
//         </div>
  
//       </div>
//     );
//   }

import "../../styles/login.css";
import { useState } from "react";
import PrimaryButton from "../ui/primary-button.jsx";
import TextInput from "../ui/text-input.jsx";
import { login } from "../../services/auth-service.js";

export default function LoginForm() {
  const [form, setForm] = useState({
    username: "",
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
      const { token, user } = await login(form.username, form.password);
      console.log("Login success:", user);
      // TODO: lưu token, redirect (vd: window.location.href = "/home")
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
            label="Username *"
            type="text"
            placeholder="Enter username"
            value={form.username}
            onChange={(e) => handleChange("username", e.target.value)}
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