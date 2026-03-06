import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

/* ===============================
   INDUSTRY COMPONENT
================================ */

const industries = [
  "Software",
  "Finance",
  "Healthcare",
  "Education",
  "Marketing",
  "E-commerce",
  "Real Estate",
  "Gaming",
  "AI & Data",
  "Media",
  "Construction",
  "Travel",
  "Food",
  "Automotive",
  "Other"
];

export function IndustrySection({
  selected,
  setSelected,
  customIndustry,
  setCustomIndustry
}) {
  const [showAll, setShowAll] = useState(false);

  const toggleIndustry = (item) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  const visibleIndustries = showAll
    ? industries
    : industries.slice(0, 9);

  return (
    <div className="industry-section">
      <label>Industry</label>

      <div className="industry-grid">
        {visibleIndustries.map((item) => (
          <button
            key={item}
            type="button"
            className={`industry-btn ${
              selected.includes(item) ? "selected" : ""
            }`}
            onClick={() => toggleIndustry(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="show-more"
        onClick={() => setShowAll(!showAll)}
      >
        {showAll ? "Show less" : "Show more industries"}
      </button>

      <button
        type="button"
        className="add-custom"
        onClick={() => setCustomIndustry(" ")}
      >
        + Add custom industry
      </button>

      {customIndustry !== "" && (
        <div className="custom-input">
          <input
            type="text"
            placeholder="Enter custom industry"
            value={customIndustry}
            onChange={(e) => setCustomIndustry(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

/* ===============================
   MODAL
================================ */

export default function CreateProjectModal({ onClose }) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [customIndustry, setCustomIndustry] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = () => {
    const payload = {
      name,
      description: desc,
      industries: [...selectedIndustries, customIndustry].filter(Boolean)
    };

    console.log("Project payload:", payload);
    onClose();
  };

  const modalContent = (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">

        <div className="modal-header">
          <h2>Create New Project</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Name */}
        <div className="form-group">
          <label>Project name *</label>
          <input
            type="text"
            placeholder="Enter project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label>Description</label>
          <textarea
            placeholder="Enter description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        {/* Industry */}
        <IndustrySection
          selected={selectedIndustries}
          setSelected={setSelectedIndustries}
          customIndustry={customIndustry}
          setCustomIndustry={setCustomIndustry}
        />

        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>
            + Create Project
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}