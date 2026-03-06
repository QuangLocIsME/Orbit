import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const FOLDER_COLORS = [
  { bg: "#DBEAFE", border: "#155DFC" },
  { bg: "#FFEDD4", border: "#F54900" },
  { bg: "#FCE7F3", border: "#E60076" },
  { bg: "#F3E8FF", border: "#9810FA" },
  { bg: "#DCFCE7", border: "#00A63E" },
  { bg: "#D0FAE5", border: "#009966" },
  { bg: "#E0E7FF", border: "#4F39F6" },
  { bg: "#CEFAFE", border: "#0092B8" },
  { bg: "#FFE2E2", border: "#E7000B" },
  { bg: "#FEF9C2", border: "#D08700" },
  { bg: "#CBFBF1", border: "#009689" },
  { bg: "#F3F4F6", border: "#4A5565" },
];

function FolderIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

export default function CreateFolderModal({ onClose }) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isValid = name.trim().length > 0;

  const handleSubmit = () => {
    const payload = {
      name: name.trim(),
      description: description.trim(),
      color: FOLDER_COLORS[selectedColor],
    };
    console.log("Folder payload:", payload);
    onClose();
  };

  const modalContent = (
    <div
      className="create-folder-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="create-folder-modal">
        <div className="create-folder-header">
          <div className="create-folder-title-wrap">
            <div className="create-folder-icon-wrap" style={{ background: FOLDER_COLORS[selectedColor].bg }}>
              <FolderIcon color={FOLDER_COLORS[selectedColor].border} />
            </div>
            <h2>Create New Folder</h2>
          </div>
          <button className="create-folder-close" onClick={onClose}>✕</button>
        </div>

        <div className="create-folder-form">
          <div className="form-group">
            <label>Folder Name <span className="required">*</span></label>
            <input
              type="text"
              placeholder="e.g., Marketing Campaigns"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="Add a description for this folder..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Folder Color</label>
            <div className="folder-color-grid">
              {FOLDER_COLORS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`folder-color-btn ${i === selectedColor ? "selected" : ""}`}
                  style={{ background: c.bg }}
                  onClick={() => setSelectedColor(i)}
                >
                  <FolderIcon color={c.border} />
                  {i === selectedColor && (
                    <span className="folder-color-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="create-folder-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn-create ${!isValid ? "disabled" : ""}`}
              onClick={handleSubmit}
              disabled={!isValid}
            >
              Create Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
