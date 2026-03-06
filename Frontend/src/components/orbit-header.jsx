export default function OrbitHeader() {
    return (
      <header className="orbit-header">
        <div className="logo">ORBIT</div>
  
        <nav>
          <a href="#">Features</a>
          <a href="#">Solutions</a>
          <a href="#">Pricing</a>
        </nav>
  
        <div className="actions">
          <a href="/login" className="login">Log in</a>
          <a href="/register" className="new-model">New Model</a>
        </div>
      </header>
    );
  }