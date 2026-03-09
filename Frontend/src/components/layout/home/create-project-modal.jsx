import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* ===============================
   INDUSTRY DATA
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

/* ===============================
   INDUSTRY SECTION
================================ */

function IndustrySection({
  selected,
  setSelected,
  customIndustry,
  setCustomIndustry,
  coverUrl,
  setCoverUrl
}) {
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef(null);

  const toggleIndustry = (item) => {
    setSelected((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item]
    );
  };

  const visibleIndustries = showAll
    ? industries
    : industries.slice(0, 6);

  useEffect(() => {
    if (customIndustry !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [customIndustry]);

  return (
    <div className="industry-section">

      <label>Industry</label>

      <div className="industry-grid">
        {visibleIndustries.map((item) => (
          <button
            key={item}
            type="button"
            className={`industry-btn ${selected.includes(item) ? "selected" : ""
              }`}
            onClick={() => toggleIndustry(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {/* LEFT ALIGN ACTIONS */}

      <div className="industry-actions">

        <button
          type="button"
          className="show-more"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show less industries" : "Show more industries"}
        </button>

        <button
          type="button"
          className="add-custom"
          onClick={() => setCustomIndustry("")}
        >
          + Add custom industry
        </button>

      </div>

      {/* CUSTOM INPUT */}

      {customIndustry !== null && (
        <div className="custom-input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter custom industry"
            value={customIndustry}
            onChange={(e) =>
              setCustomIndustry(e.target.value)
            }
          />
        </div>
      )}

      {/* COVER IMAGE */}

      <div className="form-group cover-field">
        <label>Cover Image URL (optional)</label>

        <input
          type="text"
          placeholder="https://example.com/image.jpg"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
        />
      </div>

    </div>
  );
}

/* ===============================
   MODAL
================================ */

export default function CreateProjectModal({ onClose }) {
  const [mounted, setMounted] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const [selectedIndustries, setSelectedIndustries] =
    useState([]);

  const [customIndustry, setCustomIndustry] =
    useState(null);

  /* Mount for portal */

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ===============================
     FORM VALIDATION
  ================================= */

  const isValid = name.trim().length > 0;

  /* ===============================
     SUBMIT
  ================================= */

  const handleSubmit = () => {
    const payload = {
      name: name.trim(),
      description: description.trim(),
      industries: [
        ...selectedIndustries,
        customIndustry?.trim()
      ].filter(Boolean)
    };
    console.log("Folder payload:", payload);
    onClose();
  };

  /* ===============================
     MODAL CONTENT
  ================================= */

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && onClose()
      }
    >
      <div className="modal">

        {/* HEADER */}

        <div className="modal-header">
          <h2>Create New Project</h2>

          <button
            className="close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* BODY */}

        <div className="modal-body">

          {/* Project name */}

          <div className="form-group">
            <label>Project name *</label>

            <input
              type="text"
              placeholder="Enter project name"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
            />
          </div>

          {/* Description */}

          <div className="form-group">
            <label>Description</label>

            <textarea
              placeholder="Enter description"
              value={desc}
              onChange={(e) =>
                setDesc(e.target.value)
              }
            />
          </div>

          {/* Industry */}

          <IndustrySection
            selected={selectedIndustries}
            setSelected={setSelectedIndustries}
            customIndustry={customIndustry}
            setCustomIndustry={setCustomIndustry}
            coverUrl={coverUrl}
            setCoverUrl={setCoverUrl}
          />

        </div>

        {/* FOOTER */}

        <div className="modal-footer">

          <button
            className="btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className={`btn-create ${!isValid ? "disabled" : ""}`}
            onClick={handleSubmit}
            disabled={!isValid}
          >
            Create Project
          </button>

        </div>

      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined")
    return null;

  return createPortal(modalContent, document.body);
}