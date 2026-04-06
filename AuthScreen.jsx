import { useState } from "react";
import { supabase } from "./supabase";

// mode: "login" | "signup" | "verify" | "reset" | "setpassword"
export default function AuthModal({ initialMode = "login", onClose, onPasswordUpdated }) {
  const [mode,        setMode]        = useState(initialMode);
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [password2,   setPassword2]   = useState("");
  const [code,        setCode]        = useState("");
  const [error,       setError]       = useState(null);
  const [message,     setMessage]     = useState(null);
  const [loading,     setLoading]     = useState(false);

  function switchMode(next) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      // success: onAuthStateChange in App.jsx handles the rest + closes modal

    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        switchMode("verify");
      }

    } else if (mode === "verify") {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
      if (error) {
        setError(error.message);
      }
      // success: SIGNED_IN event fires, App.jsx closes modal

    } else if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Password reset link sent — check your email.");
      }

    } else if (mode === "setpassword") {
      if (password !== password2) {
        setError("Passwords don't match.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Password updated! You're now signed in.");
        onPasswordUpdated?.();
      }
    }

    setLoading(false);
  }

  const titles = {
    login:       "Sign In",
    signup:      "Create Account",
    verify:      "Check Your Email",
    reset:       "Reset Password",
    setpassword: "Set New Password",
  };

  const submitLabels = {
    login:       "Sign In →",
    signup:      "Create Account →",
    verify:      "Confirm →",
    reset:       "Send Reset Link →",
    setpassword: "Save Password →",
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-card-top">
          <div className="auth-brand">SOLE PROPRIETOR</div>
          {onClose && mode !== "setpassword" && mode !== "verify" && (
            <button className="auth-close" onClick={onClose}>✕</button>
          )}
        </div>

        <h2 className="auth-title">{titles[mode]}</h2>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "verify" && (
            <>
              <p className="auth-verify-msg">We sent a confirmation code to <strong>{email}</strong>. Enter it below.</p>
              <div className="auth-field">
                <label className="auth-label">Confirmation Code</label>
                <input
                  className="auth-input"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                />
              </div>
            </>
          )}
          {mode !== "setpassword" && mode !== "verify" && (
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          )}

          {(mode === "login" || mode === "signup" || mode === "setpassword") && (
            <div className="auth-field">
              <label className="auth-label">{mode === "setpassword" ? "New Password" : "Password"}</label>
              <input
                className="auth-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          )}

          {mode === "setpassword" && (
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input
                className="auth-input"
                type="password"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          {message ? (
            <div className="auth-message">
              {message}
              <button className="auth-message-close" type="button" onClick={onPasswordUpdated ?? onClose}>
                Continue →
              </button>
            </div>
          ) : (
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Please wait…" : submitLabels[mode]}
            </button>
          )}
        </form>

        <div className="auth-links">
          {mode === "login" && (
            <>
              <button className="auth-toggle" onClick={() => switchMode("signup")}>
                No account? Sign up
              </button>
              <button className="auth-toggle" onClick={() => switchMode("reset")}>
                Forgot password?
              </button>
            </>
          )}
          {(mode === "signup" || mode === "reset" || mode === "verify") && (
            <button className="auth-toggle" onClick={() => switchMode("login")}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
