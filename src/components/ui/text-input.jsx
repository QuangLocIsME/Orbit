export default function TextInput({
  label,
  type = "text",
  placeholder = "",
  value,
  onChange,
  className = "",
  inputClassName = "",
  ...props
}) {
  return (
    <div className={["form-field", className].filter(Boolean).join(" ")}>
      {label && <label>{label}</label>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={inputClassName}
        {...props}
      />
    </div>
  );
}