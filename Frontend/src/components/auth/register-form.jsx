// import "../../styles/register.css";

// export default function RegisterForm() {
//   return (
//     <div className="auth-card">

//       {/* LEFT: FORM */}
//       <section className="auth-form">

//         <a href="/" className="back">← Back</a>

//         <h1>Create your account</h1>

//         <form className="form">

//           <label>
//             Full name
//             <input type="text" placeholder="Enter full name" />
//           </label>

//           <label>
//             Email
//             <input type="email" placeholder="Enter email" />
//           </label>

//           <label>
//             Password
//             <input type="password" placeholder="Enter password" />
//           </label>

//           <label>
//             Confirm password
//             <input type="password" placeholder="Confirm password" />
//           </label>

//           <label className="checkbox">
//             <input type="checkbox" />
//             I agree to the terms of service
//           </label>

//           <button type="submit" className="primary-btn">
//             Create account
//           </button>

//           <button type="button" className="google-btn">
//             Continue with Google
//           </button>

//           <p className="login-link">
//             Already have an account?
//             <a href="/login"> Log in</a>
//           </p>

//         </form>
//       </section>

//       {/* RIGHT: DECOR PANEL */}
//       <section className="auth-visual">
//         <div className="visual-content">
//           <h2>Join the BIM Revolution</h2>
//           <p>
//             Get started with ORBIT and transform how your team collaborates.
//           </p>
//         </div>
//       </section>

//     </div>
//   );
// }

import { useState } from "react";
import { useAuth } from "../../hooks/use-auth";
import "../../styles/register.css";

export default function RegisterForm() {

  const { register, loading, error } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agree: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (!form.agree) {
      alert("Please agree to terms");
      return;
    }

    try {
      const res = await register(form);
      alert(res.message);
    } catch {
      alert("Register failed");
    }
  };

  return (
    <div className="auth-card">

      {/* LEFT: FORM */}
      <section className="auth-form">

        <a href="/" className="back">← Back</a>

        <h1>Create your account</h1>

        <form className="form" onSubmit={handleSubmit}>

          <label>
            Full name
            <input
              name="fullName"
              type="text"
              placeholder="Enter full name"
              value={form.fullName}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Email
            <input
              name="email"
              type="email"
              placeholder="Enter email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              placeholder="Enter password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              placeholder="Confirm password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
          </label>

          <label className="checkbox">
            <input
              name="agree"
              type="checkbox"
              checked={form.agree}
              onChange={handleChange}
            />
            I agree to the terms of service
          </label>

          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          <button type="button" className="google-btn">
            Continue with Google
          </button>

          <p className="login-link">
            Already have an account?
            <a href="/login"> Log in</a>
          </p>

        </form>
      </section>

      {/* RIGHT: VISUAL */}
      <section className="auth-visual">
        <div className="visual-content">
          <h2>Join the BIM Revolution</h2>
          <p>
            Get started with ORBIT and transform how your team collaborates.
          </p>
        </div>
      </section>

    </div>
  );
}