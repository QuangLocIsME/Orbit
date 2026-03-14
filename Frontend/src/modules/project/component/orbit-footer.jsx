export default function OrbitFooter() {
    return (
      <footer className="orbit-footer">
  
        <div className="footer-container">
  
          {/* LEFT — BRAND */}
          <div className="footer-brand">
            <div className="brand-logo">
              <div className="logo-box"></div>
              <span className="brand-text">ORBIT</span>
            </div>
  
            <p className="brand-desc">
              Modern BIM collaboration platform for construction teams.
            </p>
          </div>
  
          {/* PRODUCT */}
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">Enterprise</a>
          </div>
  
          {/* COMPANY */}
          <div className="footer-col">
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Careers</a>
            <a href="#">Contact</a>
          </div>
  
          {/* RESOURCES */}
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="#">Documentation</a>
            <a href="#">API</a>
            <a href="#">Support</a>
          </div>
  
        </div>
  
        {/* BOTTOM */}
        <div className="footer-bottom">
  
          <span>© 2024 ORBIT. All rights reserved.</span>
  
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </div>
  
        </div>
  
      </footer>
    );
  }